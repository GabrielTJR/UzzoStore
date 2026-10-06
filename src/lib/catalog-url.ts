/**
 * Estado do catálogo ⇄ URL — módulo NEUTRO (o seletor de ordenação é client).
 *
 * O catálogo tem dois tipos de endereço:
 *   - LIMPOS, sem query: `/produtos`, `/masculino`, `/feminino`, `/ofertas`.
 *     São os que o Google indexa e os que o menu aponta.
 *   - de FACETA: `/produtos?departamento=…&categorias=…&cores=…`. Todo filtro,
 *     busca, ordenação e paginação cai aqui, venha de qual página vier.
 *
 * ⚠️ Faceta é espaço combinatório: o GPTBot já fez 77 mil requisições em 12 h
 * varrendo essas combinações (ver "Armadilha de faceta" no CLAUDE.md). Por
 * isso TODA faceta mora sob `/produtos?`, que o robots.txt proíbe — criar
 * `/masculino?categorias=…` abriria um segundo espaço combinatório fora da
 * proibição. E todo link para faceta leva `prefetch={false}`.
 */
import { isDepartment, type Department } from "@/lib/departments";
import { isSortKey, type SortKey } from "@/lib/product-sort";

export type CatalogState = {
  department: Department | null;
  /** Slugs de categoria. */
  categorias: string[];
  /** Nomes canônicos de cor. */
  cores: string[];
  promo: boolean;
  /** Só os destaques da home (marcados pela estrela no painel). */
  destaques: boolean;
  busca: string;
  ordem: SortKey;
  pagina: number;
};

export const EMPTY_CATALOG: CatalogState = {
  department: null,
  categorias: [],
  cores: [],
  promo: false,
  destaques: false,
  busca: "",
  ordem: "categoria",
  pagina: 1,
};

/** Endereço de faceta para um estado (sempre sob `/produtos`). */
export function catalogHref(state: CatalogState): string {
  const params = new URLSearchParams();
  if (state.department) params.set("departamento", state.department);
  if (state.categorias.length)
    params.set("categorias", state.categorias.join(","));
  if (state.cores.length) params.set("cores", state.cores.join(","));
  if (state.promo) params.set("promo", "1");
  if (state.destaques) params.set("destaques", "1");
  if (state.busca) params.set("busca", state.busca);
  if (state.ordem !== "categoria") params.set("ordem", state.ordem);
  if (state.pagina > 1) params.set("pagina", String(state.pagina));
  const qs = params.toString();
  return qs ? `/produtos?${qs}` : "/produtos";
}

type Param = string | string[] | undefined;

function first(v: Param): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function csv(v: Param): string[] {
  const raw = Array.isArray(v) ? v.join(",") : (v ?? "");
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Lê a query de `/produtos`. Categorias e cores saem CRUAS (slugs e nomes como
 * vieram): quem valida contra o cadastro é o `Catalog`, que tem os dados.
 */
export function parseCatalogParams(sp: Record<string, Param>): CatalogState {
  const dep = first(sp.departamento);
  const ordem = first(sp.ordem);
  const pagina = parseInt(first(sp.pagina) ?? "1", 10);
  const promo = Array.isArray(sp.promo)
    ? sp.promo.includes("1")
    : sp.promo === "1";
  return {
    department: isDepartment(dep) ? dep : null,
    // `categoria` (singular) mantido por compatibilidade com links antigos.
    categorias: [...csv(sp.categorias), ...csv(sp.categoria)],
    cores: csv(sp.cores),
    promo,
    destaques: first(sp.destaques) === "1",
    busca: first(sp.busca)?.trim() ?? "",
    ordem: isSortKey(ordem) ? ordem : "categoria",
    pagina: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
  };
}
