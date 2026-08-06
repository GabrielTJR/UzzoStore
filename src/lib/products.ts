import { createClient } from "@/lib/supabase/server";
import { compareSizes } from "@/lib/sizes";
import type { StoreCategory } from "@/lib/categories";
import { toChart, type MeasurementChart } from "@/lib/measurements";
import {
  toHomeSection,
  sectionHasContent,
  type HomeSection,
} from "@/lib/home-sections";

/** Cor exibida no card da vitrine: swatch + galeria daquela cor (capa = images[0]). */
export type ProductListColor = {
  name: string;
  hex: string | null;
  images: string[];
};

export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  price: number | null; // preço efetivo (promo ?? cheio)
  basePrice: number | null; // preço cheio (para riscar quando há promo)
  featured: boolean;
  onPromo: boolean; // tem preço promocional cadastrado
  image: string | null; // capa padrão (1ª cor com foto)
  colors: ProductListColor[];
};

export type ProductVariant = {
  id: string;
  size: string | null;
  qty: number;
};

/** Uma cor do produto: tem galeria própria e sua própria grade de tamanhos. */
export type ProductColor = {
  id: string; // product_colors.id
  name: string; // colors.name
  hex: string | null;
  gallery: string[];
  variants: ProductVariant[];
};

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  featured: boolean;
  brand: string | null;
  reference: string | null;
  category: string | null;
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  gallery: string[]; // fallback (1ª cor) — usado em metadados/OG
  price: number | null; // preço efetivo (promo ?? cheio)
  basePrice: number | null; // preço cheio
  promoPrice: number | null; // promo, se houver
  colors: ProductColor[];
  measurement: MeasurementChart | null;
};

// Formatos das linhas retornadas pelo Supabase (embeds many-to-one = objeto,
// one-to-many = array). Tipados localmente para não depender da inferência.
type ListRow = {
  slug: string;
  featured: boolean;
  sort_order: number;
  products: {
    id: string;
    name: string;
    price: number | null;
    promo_price: number | null;
    categories: { name: string } | null;
    product_colors: {
      sort_order: number;
      gallery: unknown;
      colors: { name: string; hex: string | null } | null;
    }[];
  };
};

type DetailRow = {
  slug: string;
  featured: boolean;
  rich_description: string | null;
  meta_title: string | null;
  meta_description: string | null;
  products: {
    id: string;
    name: string;
    brand: string | null;
    reference: string | null;
    price: number | null;
    promo_price: number | null;
    categories: { name: string } | null;
    measurement_models: {
      name: string;
      columns: unknown;
      rows: unknown;
      note_top: string | null;
      note_bottom: string | null;
    } | null;
    product_colors: {
      id: string;
      sort_order: number;
      gallery: unknown;
      colors: { name: string; hex: string | null } | null;
      product_variants: {
        id: string;
        size: string | null;
        stock_cache: { qty_available: number }[];
      }[];
    }[];
  };
};

function toGallery(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

/** Preço efetivo (numérico) a partir dos campos do produto. */
function effectivePrice(
  price: number | null,
  promo: number | null,
): number | null {
  const p = price != null ? Number(price) : null;
  const promoN = promo != null ? Number(promo) : null;
  if (promoN != null && Number.isFinite(promoN) && promoN > 0) return promoN;
  return p != null && Number.isFinite(p) ? p : null;
}

/** Quantas fotos por cor o CARD carrega (a página do produto mostra todas). */
const CARD_IMAGES_PER_COLOR = 4;

/** Padrão de produtos por página na vitrine. */
export const PRODUCTS_PER_PAGE = 12;

export type ProductQuery = {
  featured?: boolean;
  categoryIds?: string[];
  /** Nomes canônicos de cor (como estão em `colors.name`). */
  colorNames?: string[];
  onlyPromo?: boolean;
  /** 1-based. Sem página, devolve tudo (uso: destaques da home). */
  page?: number;
  perPage?: number;
};

export type ProductPage = {
  items: ProductListItem[];
  total: number; // total que casa com os filtros (para montar as páginas)
};

/**
 * Produtos da vitrine, já FILTRADOS e PAGINADOS no banco — não traga o catálogo
 * inteiro para filtrar em memória (o payload cresce com o nº de fotos).
 */
export async function getProducts(
  opts: ProductQuery = {},
): Promise<ProductPage> {
  const supabase = await createClient();

  // Filtro de cor em 2 passos: um embed `!inner` filtraria também as cores
  // DEVOLVIDAS, e o card precisa de todas para mostrar as bolinhas.
  let colorProductIds: string[] | null = null;
  if (opts.colorNames?.length) {
    const { data } = await supabase
      .from("product_colors")
      .select("product_id, colors!inner ( name )")
      .in("colors.name", opts.colorNames);
    const ids = new Set<string>();
    for (const r of (data ?? []) as unknown as { product_id: string }[]) {
      ids.add(r.product_id);
    }
    colorProductIds = [...ids];
    if (colorProductIds.length === 0) return { items: [], total: 0 };
  }

  let query = supabase
    .from("product_content")
    .select(
      `slug, featured, sort_order,
       products!inner ( id, name, active_ecommerce, price, promo_price,
         categories ( name ),
         product_colors ( sort_order, gallery, colors ( name, hex ) ) )`,
      { count: "exact" },
    )
    .eq("products.active_ecommerce", true);

  if (opts.featured) query = query.eq("featured", true);
  if (opts.categoryIds?.length)
    query = query.in("products.category_id", opts.categoryIds);
  if (opts.onlyPromo) query = query.gt("products.promo_price", 0);
  if (colorProductIds) query = query.in("products.id", colorProductIds);

  // `slug` como desempate: ordem instável duplicaria/sumiria itens entre páginas.
  query = query.order("sort_order").order("slug");

  const perPage = opts.perPage ?? PRODUCTS_PER_PAGE;
  if (opts.page && opts.page > 0) {
    const from = (opts.page - 1) * perPage;
    query = query.range(from, from + perPage - 1);
  }

  const { data, error, count } = await query;
  if (error || !data) return { items: [], total: 0 };

  const rows = data as unknown as ListRow[];
  const items = rows.map((row) => {
    const colors: ProductListColor[] = (row.products.product_colors ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({
        name: c.colors?.name ?? "Cor",
        hex: c.colors?.hex ?? null,
        images: toGallery(c.gallery).slice(0, CARD_IMAGES_PER_COLOR),
      }));
    const image = colors.find((c) => c.images.length > 0)?.images[0] ?? null;
    return {
      id: row.products.id,
      slug: row.slug,
      name: row.products.name,
      category: row.products.categories?.name ?? null,
      price: effectivePrice(row.products.price, row.products.promo_price),
      basePrice: row.products.price != null ? Number(row.products.price) : null,
      featured: row.featured,
      onPromo:
        row.products.promo_price != null &&
        Number(row.products.promo_price) > 0,
      image,
      colors,
    };
  });

  return { items, total: count ?? items.length };
}

/** Blocos ATIVOS da decoração da home, na ordem — leitura pública. */
export async function getHomeSections(): Promise<HomeSection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("home_sections")
    .select("id, kind, active, sort_order, data")
    .eq("active", true)
    // `created_at` desempata: sem ele, blocos com a mesma posição saem em
    // ordem indefinida e a loja pode discordar da lista do admin.
    .order("sort_order")
    .order("created_at");
  if (error || !data) return [];
  return data
    .map((r) => toHomeSection(r))
    .filter((s): s is HomeSection => !!s && sectionHasContent(s));
}

/** Cores do cadastro global — lista do filtro (não depende do catálogo). */
export async function getStoreColors(): Promise<
  { name: string; hex: string | null }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("colors").select("name, hex");
  if (error || !data) return [];
  return data
    .map((c) => ({ name: c.name, hex: c.hex }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
    );
}

/** Categorias (setores) para o menu/filtro da vitrine — lidas do banco. */
export async function getCategories(): Promise<StoreCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("kind", "setor")
    .order("name");
  if (error || !data) return [];
  return data.map((c) => ({ id: c.id, name: c.name }));
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_content")
    .select(
      `slug, featured, rich_description, meta_title, meta_description,
       products!inner ( id, name, brand, reference, active_ecommerce, price, promo_price,
         categories ( name ),
         measurement_models ( name, columns, rows, note_top, note_bottom ),
         product_colors ( id, sort_order, gallery,
           colors ( name, hex ),
           product_variants!product_variants_product_color_id_fkey (
             id, size, stock_cache ( qty_available ) ) ) )`,
    )
    .eq("slug", slug)
    .eq("products.active_ecommerce", true)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as DetailRow;

  const colors: ProductColor[] = (row.products.product_colors ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({
      id: c.id,
      name: c.colors?.name ?? "Cor",
      hex: c.colors?.hex ?? null,
      gallery: toGallery(c.gallery),
      variants: (c.product_variants ?? [])
        .map((v) => ({
          id: v.id,
          size: v.size,
          qty: (v.stock_cache ?? []).reduce(
            (sum, s) => sum + (s.qty_available ?? 0),
            0,
          ),
        }))
        .sort((a, b) => compareSizes(a.size, b.size)),
    }));

  const gallery = colors.flatMap((c) => c.gallery);

  return {
    id: row.products.id,
    slug: row.slug,
    name: row.products.name,
    featured: row.featured,
    brand: row.products.brand,
    reference: row.products.reference,
    category: row.products.categories?.name ?? null,
    description: row.rich_description,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    gallery,
    price: effectivePrice(row.products.price, row.products.promo_price),
    basePrice: row.products.price != null ? Number(row.products.price) : null,
    promoPrice:
      row.products.promo_price != null
        ? Number(row.products.promo_price)
        : null,
    colors,
    measurement: row.products.measurement_models
      ? toChart(row.products.measurement_models)
      : null,
  };
}
