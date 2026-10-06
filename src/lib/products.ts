import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { compareSizes } from "@/lib/sizes";
import { displayProductName } from "@/lib/product-name";
import type { SortKey } from "@/lib/product-sort";
export { SORT_OPTIONS, isSortKey, type SortKey } from "@/lib/product-sort";
import { categorySlug, type StoreCategory } from "@/lib/categories";
import { DEPARTMENT_COLUMN_READY, type Department } from "@/lib/departments";
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
  /** Nenhum tamanho de nenhuma cor com saldo (nem reservado em compra que
   * pode voltar). O card mostra "Esgotado" — sem isso o cliente só descobria
   * depois de abrir a peça e escolher o tamanho. Pode faltar em entrada antiga
   * do cache (vale como falso). */
  esgotado?: boolean;
};

export type ProductVariant = {
  id: string;
  size: string | null;
  qty: number;
  /**
   * Saldo zero por RESERVA de outra compra em curso, não por fim de estoque.
   * Existe para a página dizer "em processo de compra" em vez de "esgotado" —
   * a peça pode voltar em minutos, e "esgotado" faria o cliente desistir.
   */
  reservado: boolean;
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
  /** Seção da peça (unissex conta como masculino para o caminho). */
  department: "masculino" | "feminino";
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
    category_name: string | null;
    product_colors: {
      sort_order: number;
      gallery: unknown;
      colors: { name: string; hex: string | null } | null;
      product_variants?: {
        stock_cache:
          | { qty_available: number; reservado_ate: string | null }[]
          | { qty_available: number; reservado_ate: string | null }
          | null;
      }[];
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
    category_name: string | null;
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
        stock_cache: {
          qty_available: number;
          reservado_ate: string | null;
        }[];
      }[];
    }[];
  };
};

function toGallery(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

/**
 * Deixa o termo no mesmo formato de `products.name_search`: minúsculo e sem
 * acento. `NFD` separa a letra do acento e o range ̀-ͯ remove só as
 * marcas — o "ç" vira "c" pelo mesmo caminho.
 */
export function normalizeSearch(term: string): string {
  return term.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
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

/**
 * Etiquetas do cache persistente. As leituras da vitrine são iguais para todo
 * visitante, então ficam no cache do Next (não só por requisição) e só são
 * refeitas quando o admin salva algo — `revalidateTag` em `admin/actions.ts`.
 */
export const CACHE_TAGS = {
  catalogo: "catalogo",
  cores: "cores",
  categorias: "categorias",
  decoracao: "decoracao",
  /** Capas e categorias do menu (layout de TODA página). Separada de
   * `catalogo` porque estoque não muda capa: com a mesma etiqueta, cada
   * checkout iniciado (que derruba `catalogo` ao reservar) refazia também a
   * leitura de até 400 peças das capas. Quem a derruba é a edição de produto
   * (`revalidateProduct`) e de categoria (via `categorias`). */
  capas: "capas",
} as const;

/**
 * Fôlego máximo do cache quando nada é salvo no admin. Toda edição derruba a
 * etiqueta na hora (`updateTag`), então isto só limita mudanças que não passam
 * pelo admin — o estoque baixando por uma venda, por exemplo. Daí a janela
 * curta no produto: é lá que aparece "esgotado".
 */
const CACHE_LISTA = 600; // 10 min
const CACHE_PRODUTO = 300; // 5 min
const CACHE_CADASTROS = 3600; // cores/categorias/decoração: só mudam pelo admin

/** Quantas fotos por cor o CARD carrega (a página do produto mostra todas). */
const CARD_IMAGES_PER_COLOR = 4;

/**
 * Padrão de produtos por página na vitrine. Eram 12 enquanto a grade tinha 3
 * colunas num miolo de 80% da tela; com a loja em largura inteira (até 5
 * colunas) 12 peças viravam pouco mais de duas fileiras. As fotos seguem
 * `loading="lazy"`: a página maior só baixa imagem do que o cliente rola.
 */
export const PRODUCTS_PER_PAGE = 24;

export type ProductQuery = {
  featured?: boolean;
  /** Masculino/Feminino. Peças "unissex" entram nos dois. */
  department?: Department;
  categoryIds?: string[];
  /** Nomes canônicos de cor (como estão em `colors.name`). */
  colorNames?: string[];
  onlyPromo?: boolean;
  /** Busca por nome do produto. */
  search?: string;
  /** Ordenação (padrão: categoria). */
  sort?: SortKey;
  /** Restringe a estes produtos (uso: página de favoritos). */
  productIds?: string[];
  /** 1-based. Sem página, devolve tudo (uso: destaques da home). */
  page?: number;
  perPage?: number;
};

export type ProductPage = {
  items: ProductListItem[];
  total: number; // total que casa com os filtros (para montar as páginas)
  /** Pediu-se uma página além da última (o banco recusa o intervalo). */
  foraDoFim?: boolean;
};

/**
 * Produtos da vitrine, já FILTRADOS e PAGINADOS no banco — não traga o catálogo
 * inteiro para filtrar em memória (o payload cresce com o nº de fotos).
 */
async function queryProducts(opts: ProductQuery): Promise<ProductPage> {
  const supabase = createPublicClient();

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
      // `category_name`/`effective_price` são colunas do produto (migração
      // 0013): dispensam o join com `categories` e são o que o PostgREST
      // consegue ordenar através do embed.
      `slug, featured,
       products!inner ( id, name, price, promo_price, category_name, effective_price,
         product_colors ( sort_order, gallery, colors ( name, hex ),
           product_variants!product_variants_product_color_id_fkey (
             stock_cache ( qty_available, reservado_ate ) ) ) )`,
      { count: "exact" },
    )
    .eq("products.active_ecommerce", true);

  if (opts.featured) query = query.eq("featured", true);
  if (opts.department) {
    if (DEPARTMENT_COLUMN_READY) {
      query = query.in("products.department", [opts.department, "unissex"]);
    } else if (opts.department !== "masculino") {
      // Antes da migração 0022 não há coluna: o catálogo inteiro é masculino,
      // então qualquer outro departamento é vazio por definição.
      return { items: [], total: 0 };
    }
  }
  if (opts.categoryIds?.length)
    query = query.in("products.category_id", opts.categoryIds);
  if (opts.onlyPromo) query = query.gt("products.promo_price", 0);
  if (opts.search) {
    // `%` e `,` quebrariam o filtro do PostgREST; escapamos antes.
    const termo = normalizeSearch(opts.search.replace(/[%,()]/g, " ").trim());
    // Compara com `name_search` (minúscula e sem acento, migração 0014) — o
    // cadastro do ERP mistura "CALÇA" e "SUETER", e no celular se digita sem
    // acento. Normalizar só um dos lados falharia no outro sentido.
    if (termo) query = query.like("products.name_search", `%${termo}%`);
  }
  if (colorProductIds) query = query.in("products.id", colorProductIds);
  if (opts.productIds) {
    if (opts.productIds.length === 0) return { items: [], total: 0 };
    query = query.in("products.id", opts.productIds);
  }

  // Ordenação por coluna do embed `products` (o PostgREST aceita 1 nível; por
  // isso `category_name` e `effective_price` são colunas do produto — migração
  // 0013). `slug` fecha como desempate: ordem instável duplicaria/sumiria
  // itens entre páginas.
  // Ordenação: `products(coluna)` no order de topo reordena o resultado.
  // (`referencedTable` NÃO serve aqui — ele ordena as linhas dentro do embed.)
  // Só funciona com 1 nível, por isso `category_name`/`effective_price` são
  // colunas materializadas em `products` (migração 0013).
  const sort: SortKey = opts.sort ?? "categoria";
  if (sort === "menor-preco") {
    query = query.order("products(effective_price)", { ascending: true });
  } else if (sort === "maior-preco") {
    query = query.order("products(effective_price)", { ascending: false });
  } else if (sort === "nome") {
    query = query.order("products(name)", { ascending: true });
  } else if (sort === "promocao") {
    query = query
      .order("products(promo_price)", { ascending: false, nullsFirst: false })
      .order("products(effective_price)", { ascending: true });
  } else {
    query = query
      .order("products(category_name)", { ascending: true, nullsFirst: false })
      .order("products(name)", { ascending: true });
  }
  query = query.order("slug");

  const perPage = opts.perPage ?? PRODUCTS_PER_PAGE;
  if (opts.page && opts.page > 0) {
    const from = (opts.page - 1) * perPage;
    query = query.range(from, from + perPage - 1);
  }

  const { data, error, count } = await query;
  // Página além da última: o PostgREST recusa o intervalo (416, PGRST103).
  // Não é falha — quem chama manda o cliente para uma página que existe.
  if (error?.code === "PGRST103")
    return { items: [], total: 0, foraDoFim: true };
  // Falha de verdade LANÇA: dentro do `unstable_cache`, devolver lista vazia
  // gravaria "0 peças" por até 10 min (e, com a página guardada pronta, a
  // própria página). Lançando, nada é gravado e a versão anterior da página
  // continua no ar.
  if (error || !data)
    throw new Error(`produtos: ${error?.message ?? "sem dados"}`);

  const rows = data as unknown as ListRow[];
  const agora = new Date().toISOString();
  const items = rows.map((row) => {
    // Esgotado = nenhuma variante com saldo nem com reserva em curso (a peça
    // reservada pode voltar em minutos: não é "esgotado", é a regra da 0020).
    const estoques = (row.products.product_colors ?? []).flatMap((c) =>
      (c.product_variants ?? []).flatMap((v) =>
        v.stock_cache == null
          ? []
          : Array.isArray(v.stock_cache)
            ? v.stock_cache
            : [v.stock_cache],
      ),
    );
    const esgotado = !estoques.some(
      (s) =>
        Number(s.qty_available) > 0 ||
        (s.reservado_ate != null && s.reservado_ate > agora),
    );
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
      name: displayProductName(row.products.name),
      category: row.products.category_name,
      price: effectivePrice(row.products.price, row.products.promo_price),
      basePrice: row.products.price != null ? Number(row.products.price) : null,
      featured: row.featured,
      onPromo:
        row.products.promo_price != null &&
        Number(row.products.promo_price) > 0,
      image,
      colors,
      esgotado,
    };
  });

  return { items, total: count ?? items.length };
}

/**
 * Cacheado no servidor: o mesmo filtro/página devolve o mesmo resultado para
 * todos, então uma consulta serve todas as visitas até o admin editar algo.
 * (`unstable_cache` inclui os argumentos na chave.)
 */
const cachedProducts = unstable_cache(queryProducts, ["produtos"], {
  revalidate: CACHE_LISTA,
  tags: [CACHE_TAGS.catalogo],
});

export function getProducts(opts: ProductQuery = {}): Promise<ProductPage> {
  return cachedProducts(opts);
}

/**
 * Existe ao menos uma peça ativa neste departamento? Decide se o Feminino
 * aparece como "em breve" (menu, home e /feminino). Sai do MESMO cache do
 * catálogo: uma consulta por janela, derrubada quando o admin salva um produto
 * — o Feminino "acende" sozinho quando a primeira peça for cadastrada.
 */
export async function hasDepartmentProducts(
  department: Department,
): Promise<boolean> {
  // Lido pelo layout de toda página: uma falha aqui não pode derrubar a loja.
  try {
    const { total } = await getProducts({ department, page: 1, perPage: 1 });
    return total > 0;
  } catch (e) {
    console.error("[catalogo] departamento", e);
    return false;
  }
}

/**
 * Falha de leitura NUNCA pode entrar no `unstable_cache`.
 *
 * Em 21/08/2026 o projeto do Supabase foi bloqueado por estourar a cota de
 * egress e TODA consulta passou a responder 402. Estas funções devolviam `[]` no
 * erro, então o cache guardou "não há decoração nenhuma" — e quando o serviço
 * voltou, a home continuou no layout padrão, sem banner e sem vitrine, presa até
 * a janela de 1h expirar. O mesmo valeria para o menu de categorias e o filtro
 * de cores.
 *
 * O conserto tem duas metades e as duas importam: a função cacheada LANÇA (nada
 * é gravado quando o banco falha) e o chamador CAPTURA (a página degrada em vez
 * de quebrar — sem isso, um soluço do Supabase derrubaria o site inteiro, já que
 * o menu vem daqui). É o mesmo desenho que `lib/shipping.ts` já usa na cotação.
 */
async function semCachearFalha<T>(
  ler: () => Promise<T>,
  vazio: T,
  o_que: string,
): Promise<T> {
  try {
    return await ler();
  } catch (e) {
    console.error(`[catalogo] leitura de ${o_que} falhou`, e);
    return vazio;
  }
}

/**
 * Blocos ATIVOS da decoração da home, na ordem — leitura pública.
 * Memoizado por requisição: o layout (faixa de aviso) e a home chamam os dois.
 */
const homeSectionsCache = unstable_cache(
  async (): Promise<HomeSection[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("home_sections")
      .select("id, kind, active, sort_order, data")
      .eq("active", true)
      // `created_at` desempata: sem ele, blocos com a mesma posição saem em
      // ordem indefinida e a loja pode discordar da lista do admin.
      .order("sort_order")
      .order("created_at");
    if (error) throw new Error(`home_sections: ${error.message}`);
    return (data ?? [])
      .map((r) => toHomeSection(r))
      .filter((s): s is HomeSection => !!s && sectionHasContent(s));
  },
  ["home-sections"],
  { revalidate: CACHE_CADASTROS, tags: [CACHE_TAGS.decoracao] },
);

export const getHomeSections = cache((): Promise<HomeSection[]> =>
  semCachearFalha(homeSectionsCache, [], "decoração da home"),
);

/** Cores do cadastro global — lista do filtro (não depende do catálogo). */
const storeColorsCache = unstable_cache(
  async (): Promise<{ name: string; hex: string | null }[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase.from("colors").select("name, hex");
    if (error) throw new Error(`colors: ${error.message}`);
    return (data ?? [])
      .map((c) => ({ name: c.name, hex: c.hex }))
      .sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
      );
  },
  ["store-colors"],
  { revalidate: CACHE_CADASTROS, tags: [CACHE_TAGS.cores] },
);

export const getStoreColors = cache(
  (): Promise<{ name: string; hex: string | null }[]> =>
    semCachearFalha(storeColorsCache, [], "cores da loja"),
);

/** Categorias (setores) para o menu/filtro da vitrine — lidas do banco. */
const categoriesCache = unstable_cache(
  async (): Promise<StoreCategory[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name")
      .eq("kind", "setor")
      .order("name");
    if (error) throw new Error(`categories: ${error.message}`);
    return (data ?? []).map((c) => ({ id: c.id, name: c.name }));
  },
  ["categories"],
  { revalidate: CACHE_CADASTROS, tags: [CACHE_TAGS.categorias] },
);

export const getCategories = cache((): Promise<StoreCategory[]> =>
  semCachearFalha(categoriesCache, [], "categorias"),
);

/** Capa de cada categoria (atalhos da home): categoria → 1ª foto encontrada. */
export type CategoryCover = {
  id: string;
  name: string;
  image: string | null;
  count: number;
};

/**
 * Categorias com peça ativa, SEPARADAS por departamento. As categorias não têm
 * departamento no banco — quem tem é o produto (`products.department`) —, então
 * a divisão é derivada das peças: "Polos" está no Masculino porque existe polo
 * masculina ativa. Peça "unissex" conta nos dois.
 *
 * É a fonte do menu (painel de cada departamento), dos atalhos da home, do
 * filtro "Categoria" dentro de /masculino e /feminino, do 404 das rotas
 * `/<departamento>/<categoria>` e do sitemap. Antes o menu lia `getCategories`
 * (o cadastro inteiro) e listava tudo sob o Masculino, inclusive categoria sem
 * peça nenhuma — clique que caía numa página vazia.
 */
export type CategoryCoversByDepartment = Record<Department, CategoryCover[]>;

const SEM_CAPAS: CategoryCoversByDepartment = { masculino: [], feminino: [] };

/**
 * UMA consulta só (não uma por categoria nem por departamento), com a etiqueta
 * do catálogo — salvar produto ou categoria no admin derruba as duas (o
 * `updateCategoryAction` também chama `updateTag(catalogo)`, então renomear
 * categoria reflete no menu na hora). Traz só categoria, departamento e
 * galerias — nada de preço, variante ou estoque. O teto de 400 linhas protege o
 * payload quando o catálogo crescer (a capa de uma categoria não precisa de
 * todas as peças dela).
 *
 * A chave mudou de "category-covers" para "category-covers-dep" junto com o
 * formato do retorno: com a chave antiga, o primeiro acesso depois do deploy
 * podia ler do cache um array no lugar do objeto por departamento.
 */
const categoryCoversCache = unstable_cache(
  async (): Promise<CategoryCoversByDepartment> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("product_content")
      .select(
        // Sem a migração 0022 não há coluna: pedir `department` derrubaria a
        // consulta inteira (ver DEPARTMENT_COLUMN_READY).
        `featured, products!inner ( category_id, category_name,
           ${DEPARTMENT_COLUMN_READY ? "department," : ""}
           product_colors ( sort_order, gallery ) )`,
      )
      .eq("products.active_ecommerce", true)
      .order("featured", { ascending: false })
      .order("slug")
      .limit(400);
    if (error) throw new Error(`capas de categoria: ${error.message}`);
    type Row = {
      products: {
        category_id: string | null;
        category_name: string | null;
        department?: string | null;
        product_colors: { sort_order: number; gallery: unknown }[];
      };
    };
    const maps: Record<Department, Map<string, CategoryCover>> = {
      masculino: new Map(),
      feminino: new Map(),
    };
    for (const row of (data ?? []) as unknown as Row[]) {
      const p = row.products;
      if (!p.category_id || !p.category_name) continue;
      // Sem coluna (ou valor estranho), a peça conta como masculina — mesma
      // regra de `getProducts` e da página do produto.
      const dep = p.department ?? "masculino";
      const destinos: Department[] =
        dep === "unissex"
          ? ["masculino", "feminino"]
          : dep === "feminino"
            ? ["feminino"]
            : ["masculino"];
      const cover =
        (p.product_colors ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((c) => toGallery(c.gallery)[0])
          .find(Boolean) ?? null;
      for (const d of destinos) {
        const atual = maps[d].get(p.category_id);
        if (!atual) {
          maps[d].set(p.category_id, {
            id: p.category_id,
            name: p.category_name,
            image: cover,
            count: 1,
          });
        } else {
          atual.count += 1;
          if (!atual.image && cover) atual.image = cover;
        }
      }
    }
    // As categorias com mais peças primeiro: é o que a loja mais tem a mostrar.
    const ordena = (m: Map<string, CategoryCover>) =>
      [...m.values()].sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"),
      );
    return {
      masculino: ordena(maps.masculino),
      feminino: ordena(maps.feminino),
    };
  },
  ["category-covers-dep"],
  {
    revalidate: CACHE_CADASTROS,
    tags: [CACHE_TAGS.capas, CACHE_TAGS.categorias],
  },
);

export const getCategoryCovers = cache(
  (): Promise<CategoryCoversByDepartment> =>
    semCachearFalha(categoryCoversCache, SEM_CAPAS, "capas de categoria"),
);

/**
 * A categoria deste slug, SE ela tiver peça ativa neste departamento — é o que
 * decide o 404 de `/masculino/<categoria>` e `/feminino/<categoria>`. Sai do
 * mesmo cache das capas (memoizado por requisição: metadata e página dividem).
 */
export async function getDepartmentCategory(
  department: Department,
  slug: string,
): Promise<CategoryCover | null> {
  const covers = await getCategoryCovers();
  return covers[department].find((c) => categorySlug(c.name) === slug) ?? null;
}

async function queryProductBySlug(slug: string): Promise<ProductDetail | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("product_content")
    .select(
      `slug, featured, rich_description, meta_title, meta_description,
       products!inner ( id, name, brand, reference, price, promo_price, category_name,
         ${DEPARTMENT_COLUMN_READY ? "department," : ""}
         measurement_models ( name, columns, rows, note_top, note_bottom ),
         product_colors ( id, sort_order, gallery,
           colors ( name, hex ),
           product_variants!product_variants_product_color_id_fkey (
             id, size, stock_cache ( qty_available, reservado_ate ) ) ) )`,
    )
    .eq("slug", slug)
    .eq("products.active_ecommerce", true)
    .maybeSingle();

  // Falha do banco LANÇA em vez de "não existe": devolver null gravaria um
  // 404 de 5 min para o link que o cliente acabou de receber no Instagram.
  if (error) throw new Error(`produto ${slug}: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as DetailRow;
  const agora = new Date().toISOString();

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
          // Vem no MESMO embed do estoque: nenhuma consulta a mais.
          reservado: (v.stock_cache ?? []).some(
            (st) => st.reservado_ate != null && st.reservado_ate > agora,
          ),
        }))
        .sort((a, b) => compareSizes(a.size, b.size)),
    }));

  const gallery = colors.flatMap((c) => c.gallery);

  return {
    id: row.products.id,
    slug: row.slug,
    name: displayProductName(row.products.name),
    featured: row.featured,
    brand: row.products.brand,
    reference: row.products.reference,
    category: row.products.category_name,
    department:
      (row.products as { department?: string | null }).department === "feminino"
        ? "feminino"
        : "masculino",
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

/**
 * Página do produto: também cacheada por slug. A etiqueta `catalogo` derruba
 * tudo de uma vez quando o admin edita qualquer produto — mais simples e mais
 * seguro do que tentar acertar só o produto alterado (preço/estoque errado na
 * tela é pior do que uma consulta extra).
 */
const cachedProductBySlug = unstable_cache(queryProductBySlug, ["produto"], {
  revalidate: CACHE_PRODUTO,
  tags: [CACHE_TAGS.catalogo],
});

export function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  return cachedProductBySlug(slug);
}
