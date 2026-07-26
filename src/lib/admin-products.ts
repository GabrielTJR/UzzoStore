import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminProductListItem = {
  id: string;
  name: string;
  category: string | null;
  slug: string | null;
  active: boolean;
  featured: boolean;
  price: number | null;
  images: number;
};

export type AdminVariant = {
  id: string;
  size: string | null;
  color: string | null;
  price: number | null;
  qty: number;
};

export type AdminProduct = {
  id: string;
  name: string;
  reference: string | null;
  categoryId: string | null;
  categoryName: string | null;
  active: boolean;
  featured: boolean;
  slug: string | null;
  description: string | null;
  gallery: string[];
  variants: AdminVariant[];
};

type ListRow = {
  id: string;
  name: string;
  active_ecommerce: boolean;
  categories: { name: string } | null;
  product_content: { slug: string; featured: boolean; gallery: unknown } | null;
  product_variants: { prices: { price: number }[] }[];
};

type DetailRow = {
  id: string;
  name: string;
  reference: string | null;
  active_ecommerce: boolean;
  category_id: string | null;
  categories: { id: string; name: string } | null;
  product_content: {
    slug: string;
    rich_description: string | null;
    featured: boolean;
    gallery: unknown;
  } | null;
  product_variants: {
    id: string;
    size: string | null;
    color: string | null;
    prices: { price: number }[];
    stock_cache: { qty_available: number }[];
  }[];
};

function toGallery(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

function lowestPrice(variants: { prices: { price: number }[] }[]): number | null {
  const values = variants
    .flatMap((v) => v.prices ?? [])
    .map((p) => Number(p.price))
    .filter((n) => Number.isFinite(n));
  return values.length ? Math.min(...values) : null;
}

/** Lista TODOS os produtos (inclusive inativos) — uso exclusivo do admin. */
export async function getAdminProducts(): Promise<AdminProductListItem[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .select(
      `id, name, active_ecommerce,
       categories ( name ),
       product_content ( slug, featured, gallery ),
       product_variants ( prices ( price ) )`,
    )
    .order("name");
  if (error || !data) return [];

  const rows = data as unknown as ListRow[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.categories?.name ?? null,
    slug: r.product_content?.slug ?? null,
    active: r.active_ecommerce,
    featured: r.product_content?.featured ?? false,
    price: lowestPrice(r.product_variants ?? []),
    images: toGallery(r.product_content?.gallery).length,
  }));
}

/** Detalhe completo de um produto para edição (inclusive inativo). */
export async function getAdminProduct(id: string): Promise<AdminProduct | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .select(
      `id, name, reference, active_ecommerce, category_id,
       categories ( id, name ),
       product_content ( slug, rich_description, featured, gallery ),
       product_variants ( id, size, color, prices ( price ), stock_cache ( qty_available ) )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as DetailRow;
  const variants: AdminVariant[] = (row.product_variants ?? [])
    .map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      price: v.prices?.[0] ? Number(v.prices[0].price) : null,
      qty: (v.stock_cache ?? []).reduce((s, x) => s + (x.qty_available ?? 0), 0),
    }))
    .sort((a, b) => (a.size ?? "").localeCompare(b.size ?? ""));

  return {
    id: row.id,
    name: row.name,
    reference: row.reference,
    categoryId: row.category_id,
    categoryName: row.categories?.name ?? null,
    active: row.active_ecommerce,
    featured: row.product_content?.featured ?? false,
    slug: row.product_content?.slug ?? null,
    description: row.product_content?.rich_description ?? null,
    gallery: toGallery(row.product_content?.gallery),
    variants,
  };
}
