import Link from "next/link";
import { redirect } from "next/navigation";
import { whatsappLink } from "@/lib/store-info";
import { FilterBar, type FilterGroup } from "@/components/filter-bar";
import { FilterOption } from "@/components/filter-option";
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

/**
 * Tipo da navegação dos filtros, limpar e páginas: nela a foto do
 * card NÃO voa e a página não esmaece (ver `share`/`default` nos
 * `<ViewTransition>` e o CSS de `filtro`). Sem isso, cada toque num filtro
 * virava uma transição de página — as fotos subiam por cima da folha de
 * filtros do celular e a tela piscava.
 */
const FILTRO = ["filtro"];

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
 * O CATÁLOGO: título, barra de filtros (sob o título, grudada ao rolar), grade
 * e paginação — em largura inteira. A lateral de filtros saiu em 14/10/2026
 * (o dono escolheu a "barra no topo": a grade ganha a largura toda). É o mesmo componente em `/produtos` (lê a query) e nas páginas de
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

  const {
    items: products,
    total,
    foraDoFim,
  } = await getProducts({
    department: state.department ?? undefined,
    categoryIds: categorias.map((s) => bySlug.get(s)!.id),
    colorNames: cores,
    onlyPromo: state.promo,
    featured: state.destaques || undefined,
    search: state.busca,
    sort: state.ordem,
    page: state.pagina,
  });

  // Página que não existe mais (?pagina=99, ou a 3 depois que peças saíram):
  // volta para a 1ª com os mesmos filtros, em vez de "0 peças".
  if (foraDoFim && state.pagina > 1)
    redirect(catalogHref({ ...state, pagina: 1 }));

  const totalPages = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));
  const page = Math.min(state.pagina, totalPages);
  const activeCount =
    categorias.length +
    cores.length +
    (state.promo ? 1 : 0) +
    (state.destaques ? 1 : 0);
  const aquiHref = catalogHref(state);

  const heading =
    title ??
    (state.busca
      ? `Busca por “${state.busca}”`
      : state.department
        ? DEPARTMENTS[state.department]
        : state.promo
          ? "Ofertas"
          : state.destaques
            ? "Destaques"
            : "Produtos");

  const limpar =
    "text-xs text-muted underline underline-offset-4 hover:text-foreground";

  // Só oferece trocar de departamento quando há mais de um com peças.
  const departamentos = (Object.keys(DEPARTMENTS) as Department[]).filter(
    (d) => d !== "feminino" || temFeminino,
  );

  // Grupos da barra de filtros. Cada um é um botão; as opções abrem numa
  // caixinha (computador) ou numa folha que sobe de baixo (celular).
  const limparLink = (href: string) => (
    <Link
      prefetch={false}
      transitionTypes={FILTRO}
      data-filtro
      href={href}
      scroll={false}
      className={limpar}
    >
      limpar
    </Link>
  );
  const groups: FilterGroup[] = [];
  if (departamentos.length > 1)
    groups.push({
      id: "departamento",
      rotulo: state.department ? DEPARTMENTS[state.department] : "Seção",
      count: 0,
      conteudo: (
        <div className="grid grid-cols-2 gap-1">
          <FilterOption
            href={com({ department: null })}
            checked={!state.department}
          >
            Todos
          </FilterOption>
          {departamentos.map((d) => (
            <FilterOption
              key={d}
              href={com({ department: d })}
              checked={state.department === d}
            >
              {DEPARTMENTS[d]}
            </FilterOption>
          ))}
        </div>
      ),
    });
  if (categoriasDoFiltro.length > 0)
    groups.push({
      id: "categoria",
      rotulo: "Categoria",
      count: categorias.length,
      limpar:
        categorias.length > 0 ? limparLink(com({ categorias: [] })) : undefined,
      conteudo: (
        <div className="grid grid-cols-2 gap-1">
          {categoriasDoFiltro.map((c) => {
            const slug = categorySlug(c.name);
            const checked = categorias.includes(slug);
            return (
              <FilterOption
                key={c.id}
                href={com({
                  categorias: checked
                    ? categorias.filter((s) => s !== slug)
                    : [...categorias, slug],
                })}
                checked={checked}
              >
                {c.name}
              </FilterOption>
            );
          })}
        </div>
      ),
    });
  if (storeColors.length >= 2)
    groups.push({
      id: "cor",
      rotulo: "Cor",
      count: cores.length,
      limpar: cores.length > 0 ? limparLink(com({ cores: [] })) : undefined,
      conteudo: (
        // Cor se escolhe pela COR: bolinhas com o nome embaixo.
        <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5 lg:grid-cols-4">
          {storeColors.map((c) => {
            const checked = coresSet.has(c.name.toLowerCase());
            return (
              <FilterOption
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
              </FilterOption>
            );
          })}
        </div>
      ),
    });

  // "Em promoção": um botão de liga/desliga direto na barra — uma opção só
  // não precisa de caixinha. Some em /ofertas, que já é só promoção.
  const promoBotao =
    homePath === "/ofertas" ? null : (
      <Link
        prefetch={false}
        transitionTypes={FILTRO}
        data-filtro
        scroll={false}
        href={com({ promo: !state.promo })}
        aria-pressed={state.promo}
        className={`inline-flex h-10 shrink-0 items-center rounded-xs border px-3 text-sm lg:px-3.5 font-medium transition-colors ${
          state.promo
            ? "border-foreground bg-foreground text-background"
            : "border-border hover:border-foreground"
        }`}
      >
        Em promoção
      </Link>
    );

  const ordens = (Object.keys(SORT_OPTIONS) as SortKey[]).map((k) => ({
    key: k,
    label: SORT_OPTIONS[k],
    href: com({ ordem: k }),
  }));
  const sort = <SortSelect value={state.ordem} options={ordens} />;
  const sortCompacto = (
    <SortSelect value={state.ordem} options={ordens} compacto />
  );

  // Sem chips de filtros ativos (saíram em 14/10/2026, a pedido do dono:
  // empilhavam linhas antes da primeira peça). O número no botão do grupo diz
  // o que está marcado; "Limpar filtros" fica na linha da contagem.
  const temFiltro = activeCount > 0 || !!state.busca;

  const pageLink =
    "flex h-10 min-w-10 items-center justify-center rounded-xs border px-3 text-sm transition-colors";
  const pageHref = (p: number) =>
    `${catalogHref({ ...state, pagina: p })}#lista`;

  return (
    <section className="px-page pb-16 pt-6 lg:pb-24 lg:pt-10">
      <header className="mb-5 lg:mb-7">
        <div>
          <h1 className="titulo-entra font-display text-3xl font-extrabold lg:text-5xl">
            {heading}
          </h1>
          <div
            aria-hidden
            className="titulo-barra mt-3 h-1 w-14 bg-accent lg:w-20"
          />
          {/* No celular a ordenação mora aqui, ao lado da contagem: na barra
              ela espremia os filtros (no computador fica na própria barra). */}
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {total} {total === 1 ? "peça" : "peças"}
              {totalPages > 1 && `, página ${page} de ${totalPages}`}
            </p>
            <div className="flex items-center gap-4">
              {temFiltro && (
                <Link
                  scroll={false}
                  href={homePath}
                  transitionTypes={FILTRO}
                  data-filtro
                  className={limpar}
                >
                  Limpar filtros
                </Link>
              )}
              <div className="lg:hidden">{sortCompacto}</div>
            </div>
          </div>
        </div>
      </header>

      <FilterBar promo={promoBotao} groups={groups} sort={sort} total={total} />

      <div>
        {products.length === 0 ? (
          <div className="py-10">
            <p className="font-display text-xl font-bold">
              {state.busca
                ? `Nada encontrado para “${state.busca}”.`
                : "Nenhuma peça com esses filtros."}
            </p>
            <p className="mt-2 text-sm text-muted">
              {state.busca ? (
                <>
                  Tente outra palavra (camisa, bermuda, polo…) ou{" "}
                  <a
                    href={whatsappLink(
                      `Olá! Procurei por "${state.busca}" no site e não achei.`,
                    )}
                    className="underline underline-offset-4"
                  >
                    pergunte no WhatsApp
                  </a>
                  .
                </>
              ) : (
                "Tire um filtro ou veja a seção inteira."
              )}
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
              className="grid scroll-mt-36 grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-10 2xl:grid-cols-5"
            >
              {products.map((p, i) => (
                <ProductCard
                  key={p.slug}
                  product={p}
                  backTo={aquiHref}
                  indice={i}
                />
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
                    transitionTypes={FILTRO}
                    data-filtro
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
                      transitionTypes={FILTRO}
                      data-filtro
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
                    transitionTypes={FILTRO}
                    data-filtro
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
    </section>
  );
}
