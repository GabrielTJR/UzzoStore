import Link from "next/link";
import { FilterCheckItem as CheckItem } from "@/components/filter-check-item";
import { FilterPanel } from "@/components/filter-panel";
import { FilterSection } from "@/components/filter-section";
import { ProductCard } from "@/components/product-card";
import { SortSelect } from "@/components/sort-select";
import { catalogHref, type CatalogState } from "@/lib/catalog-url";
import { categorySlug } from "@/lib/categories";
import { displayColor } from "@/lib/color-name";
import { DEPARTMENTS, type Department } from "@/lib/departments";
import { SORT_OPTIONS, type SortKey } from "@/lib/product-sort";
import {
  getCategories,
  getCategoryCovers,
  getProducts,
  getStoreColors,
  hasDepartmentProducts,
  PRODUCTS_PER_PAGE,
} from "@/lib/products";

/** Números de página com reticências: 1 … 4 [5] 6 … 12 */
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

/**
 * O CATÁLOGO: título, filtros na lateral, grade e paginação — em largura
 * inteira. É o mesmo componente em `/produtos` (lê a query) e nas páginas de
 * endereço limpo (`/masculino`, `/feminino`, `/ofertas`), que só passam um
 * `state` pré-preenchido.
 *
 * Filtros, busca, ordenação e paginação rodam no BANCO (`getProducts`), não em
 * memória. Todo link de filtro aponta para `/produtos?…` com
 * `prefetch={false}` — ver lib/catalog-url.ts sobre o porquê.
 *
 * Os filtros de categoria e cor NÃO são facetados (a lista não oscila ao trocar
 * de filtro). A única restrição é o DEPARTAMENTO: dentro de /masculino ou
 * /feminino a "Categoria" mostra só as categorias daquele departamento — a
 * lista muda ao trocar de seção, nunca ao marcar uma caixa.
 */
export async function Catalog({
  state: raw,
  title,
  homePath = "/produtos",
}: {
  state: CatalogState;
  /** Título da página. Sem ele, sai do estado (departamento, busca…). */
  title?: string;
  /** Para onde "limpar filtros" volta: o endereço limpo desta seção. */
  homePath?: string;
}) {
  const [categories, covers, storeColors, temFeminino] = await Promise.all([
    getCategories(),
    getCategoryCovers(),
    getStoreColors(),
    hasDepartmentProducts("feminino"),
  ]);

  // Valida o que veio na URL contra o cadastro (ignora o que não existe).
  const bySlug = new Map(categories.map((c) => [categorySlug(c.name), c]));
  const categorias = raw.categorias.filter((s) => bySlug.has(s));
  // Normaliza a cor com a MESMA regra do cadastro: link antigo com ?cores=BEGE
  // segue casando depois da padronização dos nomes.
  const colorByKey = new Map(
    storeColors.map((c) => [c.name.toLowerCase(), c.name]),
  );
  const cores = raw.cores
    .map((n) => colorByKey.get(displayColor(n).toLowerCase()))
    .filter((n): n is string => !!n);
  const coresSet = new Set(cores.map((c) => c.toLowerCase()));

  const state: CatalogState = { ...raw, categorias, cores };

  // Dentro de um departamento, o filtro "Categoria" lista só as categorias com
  // peça NELE (unissex conta nos dois); em /produtos sem departamento, lista o
  // cadastro inteiro. A seleção atual entra sempre, mesmo fora da lista — senão
  // um link antigo deixaria marcada uma categoria sem caixa para desmarcar.
  const doDepartamento = state.department
    ? new Set(covers[state.department].map((c) => c.id))
    : null;
  const categoriasDoFiltro = doDepartamento
    ? categories.filter(
        (c) =>
          doDepartamento.has(c.id) || categorias.includes(categorySlug(c.name)),
      )
    : categories;
  /** Mesmo estado com alterações — e sempre de volta à página 1. */
  const com = (patch: Partial<CatalogState>) =>
    catalogHref({ ...state, pagina: 1, ...patch });

  const { items: products, total } = await getProducts({
    department: state.department ?? undefined,
    categoryIds: categorias.map((s) => bySlug.get(s)!.id),
    colorNames: cores,
    onlyPromo: state.promo,
    search: state.busca,
    sort: state.ordem,
    page: state.pagina,
  });

  const totalPages = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));
  const page = Math.min(state.pagina, totalPages);
  const activeCount = categorias.length + cores.length + (state.promo ? 1 : 0);
  const aquiHref = catalogHref(state);

  const heading =
    title ??
    (state.busca
      ? `Busca por “${state.busca}”`
      : state.department
        ? DEPARTMENTS[state.department]
        : state.promo
          ? "Ofertas"
          : "Produtos");

  const limpar =
    "text-xs text-muted underline underline-offset-4 hover:text-foreground";

  // Só oferece trocar de departamento quando há mais de um com peças.
  const departamentos = (Object.keys(DEPARTMENTS) as Department[]).filter(
    (d) => d !== "feminino" || temFeminino,
  );

  const filters = (
    <div>
      {departamentos.length > 1 && (
        <FilterSection title="Departamento">
          <CheckItem
            radio
            href={com({ department: null })}
            checked={!state.department}
          >
            Todos
          </CheckItem>
          {departamentos.map((d) => (
            <CheckItem
              key={d}
              radio
              href={com({ department: d })}
              checked={state.department === d}
            >
              {DEPARTMENTS[d]}
            </CheckItem>
          ))}
        </FilterSection>
      )}

      <FilterSection title="Ofertas" selectedCount={state.promo ? 1 : 0}>
        <CheckItem href={com({ promo: !state.promo })} checked={state.promo}>
          Em promoção
        </CheckItem>
      </FilterSection>

      {categoriasDoFiltro.length > 0 && (
        <FilterSection
          title="Categoria"
          selectedCount={categorias.length}
          action={
            categorias.length > 0 ? (
              <Link
                prefetch={false}
                href={com({ categorias: [] })}
                scroll={false}
                className={limpar}
              >
                limpar
              </Link>
            ) : null
          }
        >
          {categoriasDoFiltro.map((c) => {
            const slug = categorySlug(c.name);
            const checked = categorias.includes(slug);
            return (
              <CheckItem
                key={c.id}
                href={com({
                  categorias: checked
                    ? categorias.filter((s) => s !== slug)
                    : [...categorias, slug],
                })}
                checked={checked}
              >
                {c.name}
              </CheckItem>
            );
          })}
        </FilterSection>
      )}

      {storeColors.length >= 2 && (
        <FilterSection
          title="Cor"
          selectedCount={cores.length}
          action={
            cores.length > 0 ? (
              <Link
                prefetch={false}
                href={com({ cores: [] })}
                scroll={false}
                className={limpar}
              >
                limpar
              </Link>
            ) : null
          }
        >
          {storeColors.map((c) => {
            const checked = coresSet.has(c.name.toLowerCase());
            return (
              <CheckItem
                key={c.name}
                swatch={c.hex}
                href={com({
                  cores: checked
                    ? cores.filter(
                        (n) => n.toLowerCase() !== c.name.toLowerCase(),
                      )
                    : [...cores, c.name],
                })}
                checked={checked}
              >
                {displayColor(c.name)}
              </CheckItem>
            );
          })}
        </FilterSection>
      )}

      {activeCount > 0 && (
        <Link
          href={homePath}
          scroll={false}
          className="mt-5 inline-block text-sm underline underline-offset-4"
        >
          Limpar todos os filtros
        </Link>
      )}
    </div>
  );

  const sort = (
    <SortSelect
      value={state.ordem}
      options={(Object.keys(SORT_OPTIONS) as SortKey[]).map((k) => ({
        key: k,
        label: SORT_OPTIONS[k],
        href: com({ ordem: k }),
      }))}
    />
  );

  const chip =
    "inline-flex min-h-9 items-center gap-2 rounded-xs bg-surface py-1.5 pl-3 pr-2.5 text-xs font-medium transition-colors hover:bg-border";
  const chipX = (
    <span aria-hidden className="text-muted">
      ✕
    </span>
  );
  // Chips dos filtros ativos: mostram o que está aplicado e removem com um
  // toque — no celular os filtros ficam numa folha fechada, então sem os chips
  // o cliente não vê o que está filtrando.
  const hasChips = activeCount > 0 || !!state.busca;
  const chips = hasChips && (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {state.busca && (
        <Link
          prefetch={false}
          scroll={false}
          href={com({ busca: "" })}
          className={chip}
        >
          “{state.busca}”{chipX}
        </Link>
      )}
      {state.promo && (
        <Link
          prefetch={false}
          scroll={false}
          href={com({ promo: false })}
          className={chip}
        >
          Em promoção{chipX}
        </Link>
      )}
      {categorias.map((s) => (
        <Link
          key={s}
          prefetch={false}
          scroll={false}
          href={com({ categorias: categorias.filter((x) => x !== s) })}
          className={chip}
        >
          {bySlug.get(s)?.name ?? s}
          {chipX}
        </Link>
      ))}
      {cores.map((c) => (
        <Link
          key={c}
          prefetch={false}
          scroll={false}
          href={com({
            cores: cores.filter((x) => x.toLowerCase() !== c.toLowerCase()),
          })}
          className={chip}
        >
          {displayColor(c)}
          {chipX}
        </Link>
      ))}
      <Link scroll={false} href={homePath} className={limpar}>
        limpar tudo
      </Link>
    </div>
  );

  const pageLink =
    "flex h-10 min-w-10 items-center justify-center rounded-xs border px-3 text-sm transition-colors";
  const pageHref = (p: number) =>
    `${catalogHref({ ...state, pagina: p })}#lista`;

  return (
    <section className="px-page pb-16 pt-6 lg:pb-24 lg:pt-10">
      <header className="mb-5 flex items-end justify-between gap-6 lg:mb-8">
        <div>
          <h1 className="font-display text-3xl font-extrabold lg:text-5xl">
            {heading}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {total} {total === 1 ? "peça" : "peças"}
            {totalPages > 1 && `, página ${page} de ${totalPages}`}
          </p>
        </div>
        <div className="hidden lg:block">{sort}</div>
      </header>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-12">
        <FilterPanel activeCount={activeCount} total={total} sort={sort}>
          {filters}
        </FilterPanel>

        <div>
          {chips}

          {products.length === 0 ? (
            <div className="py-10">
              <p className="font-display text-xl font-bold">
                Nenhuma peça com esses filtros.
              </p>
              <p className="mt-2 text-sm text-muted">
                Tire um filtro ou veja a seção inteira.
              </p>
              <Link
                href={homePath}
                className="mt-5 inline-flex h-12 items-center rounded-xs bg-foreground px-6 text-sm font-semibold text-background"
              >
                Limpar filtros
              </Link>
            </div>
          ) : (
            <>
              {/* Âncora da paginação: `scroll-mt` desconta o que fica grudado
                  no topo (cabeçalho + barra de filtros do celular). */}
              <div
                id="lista"
                className="grid scroll-mt-32 grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:gap-x-5 lg:gap-y-10 xl:grid-cols-4 2xl:grid-cols-5"
              >
                {products.map((p) => (
                  <ProductCard key={p.slug} product={p} backTo={aquiHref} />
                ))}
              </div>

              {totalPages > 1 && (
                <nav
                  aria-label="Paginação"
                  className="mt-12 flex flex-wrap items-center justify-center gap-2"
                >
                  {page > 1 && (
                    <Link
                      prefetch={false}
                      href={pageHref(page - 1)}
                      aria-label="Página anterior"
                      className={`${pageLink} border-border hover:border-foreground`}
                    >
                      ‹
                    </Link>
                  )}
                  {pageWindow(page, totalPages).map((p, i) =>
                    p === "…" ? (
                      <span
                        key={`gap-${i}`}
                        aria-hidden
                        className="px-1 text-sm text-muted"
                      >
                        …
                      </span>
                    ) : (
                      <Link
                        prefetch={false}
                        key={p}
                        href={pageHref(p)}
                        aria-label={`Página ${p}`}
                        aria-current={p === page ? "page" : undefined}
                        className={`${pageLink} ${
                          p === page
                            ? "border-foreground bg-foreground font-semibold text-background"
                            : "border-border hover:border-foreground"
                        }`}
                      >
                        {p}
                      </Link>
                    ),
                  )}
                  {page < totalPages && (
                    <Link
                      prefetch={false}
                      href={pageHref(page + 1)}
                      aria-label="Próxima página"
                      className={`${pageLink} border-border hover:border-foreground`}
                    >
                      ›
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
