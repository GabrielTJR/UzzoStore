import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { compareSizes } from "@/lib/sizes";

export type AdminProductListItem = {
  id: string;
  name: string;
  category: string | null;
  slug: string | null;
  active: boolean;
  featured: boolean;
  price: number | null; // preço efetivo (promo ?? cheio)
  images: number;
  colors: number;
};

export type AdminVariant = {
  id: string;
  size: string | null;
  qty: number;
};

/** Uma cor atribuída ao produto: galeria própria + grade de tamanhos/estoque. */
export type AdminProductColor = {
  id: string; // product_colors.id
  colorId: string; // colors.id
  name: string;
  hex: string | null;
  sortOrder: number;
  gallery: string[];
  variants: AdminVariant[];
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
  price: number | null; // products.price (cheio)
  promoPrice: number | null; // products.promo_price
  colors: AdminProductColor[];
};

/** Item do cadastro GERAL de cores. */
export type ColorOption = {
  id: string;
  name: string;
  hex: string | null;
  sortOrder: number;
};

type ListRow = {
  id: string;
  name: string;
  active_ecommerce: boolean;
  price: number | null;
  promo_price: number | null;
  categories: { name: string } | null;
  product_content: { slug: string; featured: boolean } | null;
  product_colors: { gallery: unknown }[];
};

type DetailRow = {
  id: string;
  name: string;
  reference: string | null;
  active_ecommerce: boolean;
  category_id: string | null;
  price: number | null;
  promo_price: number | null;
  categories: { id: string; name: string } | null;
  product_content: {
    slug: string;
    rich_description: string | null;
    featured: boolean;
  } | null;
  product_colors: {
    id: string;
    sort_order: number;
    gallery: unknown;
    colors: { id: string; name: string; hex: string | null } | null;
    product_variants: {
      id: string;
      size: string | null;
      stock_cache: { qty_available: number }[];
    }[];
  }[];
};

function toGallery(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

function effectivePrice(
  price: number | null,
  promo: number | null,
): number | null {
  const promoN = promo != null ? Number(promo) : null;
  if (promoN != null && Number.isFinite(promoN) && promoN > 0) return promoN;
  return price != null && Number.isFinite(Number(price)) ? Number(price) : null;
}

/** Lista TODOS os produtos (inclusive inativos) — uso exclusivo do admin. */
export async function getAdminProducts(): Promise<AdminProductListItem[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .select(
      `id, name, active_ecommerce, price, promo_price,
       categories ( name ),
       product_content ( slug, featured ),
       product_colors ( gallery )`,
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
    price: effectivePrice(r.price, r.promo_price),
    images: (r.product_colors ?? []).reduce(
      (n, c) => n + toGallery(c.gallery).length,
      0,
    ),
    colors: (r.product_colors ?? []).length,
  }));
}

/** Detalhe completo de um produto para edição (inclusive inativo). */
export async function getAdminProduct(id: string): Promise<AdminProduct | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .select(
      `id, name, reference, active_ecommerce, category_id, price, promo_price,
       categories ( id, name ),
       product_content ( slug, rich_description, featured ),
       product_colors ( id, sort_order, gallery,
         colors ( id, name, hex ),
         product_variants!product_variants_product_color_id_fkey (
           id, size, stock_cache ( qty_available ) ) )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as DetailRow;

  const colors: AdminProductColor[] = (row.product_colors ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({
      id: c.id,
      colorId: c.colors?.id ?? "",
      name: c.colors?.name ?? "Cor",
      hex: c.colors?.hex ?? null,
      sortOrder: c.sort_order,
      gallery: toGallery(c.gallery),
      variants: (c.product_variants ?? [])
        .map((v) => ({
          id: v.id,
          size: v.size,
          qty: (v.stock_cache ?? []).reduce(
            (s, x) => s + (x.qty_available ?? 0),
            0,
          ),
        }))
        .sort((a, b) => compareSizes(a.size, b.size)),
    }));

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
    price: row.price != null ? Number(row.price) : null,
    promoPrice: row.promo_price != null ? Number(row.promo_price) : null,
    colors,
  };
}

/** Cadastro GERAL de cores (para selects e para a tela /admin/cores). */
export async function getAllColors(): Promise<ColorOption[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("colors")
    .select("id, name, hex, sort_order")
    .order("sort_order")
    .order("name");
  if (error || !data) return [];
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    hex: c.hex,
    sortOrder: c.sort_order,
  }));
}

/** Uso do cadastro geral de cores (quantos produtos usam cada cor). */
export async function getColorUsage(): Promise<Record<string, number>> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("product_colors").select("color_id");
  if (error || !data) return {};
  const usage: Record<string, number> = {};
  for (const row of data as { color_id: string }[]) {
    usage[row.color_id] = (usage[row.color_id] ?? 0) + 1;
  }
  return usage;
}
