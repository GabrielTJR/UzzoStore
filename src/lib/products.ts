import { createClient } from "@/lib/supabase/server";

export type ProductListItem = {
  slug: string;
  name: string;
  category: string | null;
  price: number | null;
  featured: boolean;
  image: string | null;
};

export type ProductVariant = {
  id: string;
  size: string | null;
  color: string | null;
  price: number | null;
  qty: number;
};

export type ProductDetail = {
  slug: string;
  name: string;
  brand: string | null;
  reference: string | null;
  category: string | null;
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  gallery: string[];
  price: number | null;
  variants: ProductVariant[];
};

// Formatos das linhas retornadas pelo Supabase (embeds many-to-one = objeto,
// one-to-many = array). Tipados localmente para não depender da inferência.
type ListRow = {
  slug: string;
  featured: boolean;
  sort_order: number;
  gallery: unknown;
  products: {
    name: string;
    categories: { name: string } | null;
    product_variants: { prices: { price: number; promo_price: number | null }[] }[];
  };
};

type DetailRow = {
  slug: string;
  rich_description: string | null;
  meta_title: string | null;
  meta_description: string | null;
  gallery: unknown;
  products: {
    name: string;
    brand: string | null;
    reference: string | null;
    categories: { name: string } | null;
    product_variants: {
      id: string;
      size: string | null;
      color: string | null;
      prices: { price: number; promo_price: number | null }[];
      stock_cache: { qty_available: number }[];
    }[];
  };
};

function lowestPrice(
  variants: { prices: { price: number; promo_price: number | null }[] }[],
): number | null {
  const values = variants
    .flatMap((v) => v.prices ?? [])
    .map((p) => Number(p.promo_price ?? p.price))
    .filter((n) => Number.isFinite(n));
  return values.length ? Math.min(...values) : null;
}

export async function getProducts(
  opts: { featured?: boolean } = {},
): Promise<ProductListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("product_content")
    .select(
      `slug, featured, sort_order, gallery,
       products!inner ( name, active_ecommerce, categories ( name ),
         product_variants ( prices ( price, promo_price ) ) )`,
    )
    .eq("products.active_ecommerce", true)
    .order("sort_order");

  if (opts.featured) query = query.eq("featured", true);

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = data as unknown as ListRow[];
  return rows.map((row) => {
    const gallery = Array.isArray(row.gallery) ? (row.gallery as string[]) : [];
    return {
      slug: row.slug,
      name: row.products.name,
      category: row.products.categories?.name ?? null,
      price: lowestPrice(row.products.product_variants ?? []),
      featured: row.featured,
      image: gallery[0] ?? null,
    };
  });
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_content")
    .select(
      `slug, rich_description, meta_title, meta_description, gallery,
       products!inner ( name, brand, reference, active_ecommerce, categories ( name ),
         product_variants ( id, size, color, prices ( price, promo_price ),
           stock_cache ( qty_available ) ) )`,
    )
    .eq("slug", slug)
    .eq("products.active_ecommerce", true)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as DetailRow;
  const variants: ProductVariant[] = (row.products.product_variants ?? []).map(
    (v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      price: v.prices?.[0] ? Number(v.prices[0].promo_price ?? v.prices[0].price) : null,
      qty: (v.stock_cache ?? []).reduce((sum, s) => sum + (s.qty_available ?? 0), 0),
    }),
  );

  return {
    slug: row.slug,
    name: row.products.name,
    brand: row.products.brand,
    reference: row.products.reference,
    category: row.products.categories?.name ?? null,
    description: row.rich_description,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    gallery: Array.isArray(row.gallery) ? (row.gallery as string[]) : [],
    price: lowestPrice(row.products.product_variants ?? []),
    variants,
  };
}
