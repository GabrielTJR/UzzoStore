import Link from "next/link";
import { Suspense } from "react";
import { SearchBox } from "@/components/search-box";
import { SortSelect } from "@/components/sort-select";
import type { Metadata } from "next";
import {
  getProducts,
  getCategories,
  getStoreColors,
  PRODUCTS_PER_PAGE,
} from "@/lib/products";
import { isSortKey, type SortKey } from "@/lib/product-sort";
import { ProductCard } from "@/components/product-card";
import { FilterDisclosure } from "@/components/filter-disclosure";
import { FilterSection } from "@/components/filter-section";
import { FilterCheckItem as CheckItem } from "@/components/filter-check-item";
import { categorySlug } from "@/lib/categories";
import { getAdminUser } from "@/lib/admin";
import { getSessionUser } from "@/lib/session";
import { getWishlistIds } from "@/lib/wishlist";

export const metadata: Metadata = {
  title: "Produtos",
  description: "Peças da Uzzo Store — moda masculina em Balneário Camboriú.",
};

/** Monta a URL de /produtos com os filtros ativos (página só quando > 1). */
function buildHref(
  categorias: string[],
  cores: string[],
  promo: boolean,
  pagina = 1,
  busca = "",
  ordem: SortKey = "categoria",
): string {
  const params = new URLSearchParams();
  if (categorias.length) params.set("categorias", categorias.join(","));
  if (cores.length) params.set("cores", cores.join(","));
  if (promo) params.set("promo", "1");
  if (busca) params.set("busca", busca);
  if (ordem !== "categoria") params.set("ordem", ordem);
  if (pagina > 1) params.set("pagina", String(pagina));
  const qs = params.toString();
  return qs ? `/produtos?${qs}` : "/produtos";
}

/** Exibição do nome da cor (o cadastro tem caixa inconsistente: "BEGE", "Cinza"). */
function displayColor(name: string): string {
  return name
    .toLocaleLowerCase("pt-BR")
    .replace(
      /(^|\s|-)([\p{L}])/gu,
      (_, sep, ch) => sep + ch.toLocaleUpperCase("pt-BR"),
    );
}

function csv(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

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

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{
    categoria?: string | string[];
    categorias?: string | string[];
    cores?: string | string[];
    promo?: string | string[];
    busca?: string | string[];
    ordem?: string | string[];
    pagina?: string | string[];
  }>;
}) {
  const sp = await searchParams;
  // `categoria` (singular) mantido por compatibilidade com links antigos.
  const catParams = [...csv(sp.categorias), ...csv(sp.categoria)];
  const colorParams = csv(sp.cores);
  const busca =
    (Array.isArray(sp.busca) ? sp.busca[0] : sp.busca)?.trim() ?? "";
  const ordemParam = Array.isArray(sp.ordem) ? sp.ordem[0] : sp.ordem;
  const ordem: SortKey = isSortKey(ordemParam) ? ordemParam : "categoria";
  const onlyPromo = Array.isArray(sp.promo)
    ? sp.promo.includes("1")
    : sp.promo === "1";
  const pageParam = parseInt(
    Array.isArray(sp.pagina) ? (sp.pagina[0] ?? "1") : (sp.pagina ?? "1"),
    10,
  );

  const [categories, storeColors, adminUser, sessionUser, favorites] =
    await Promise.all([
      getCategories(),
      getStoreColors(),
      getAdminUser(),
      getSessionUser(),
      getWishlistIds(),
    ]);
  const isAdmin = !!adminUser;
  const isLogged = !!sessionUser;

  // Slugs válidos (ignora categoria inexistente na URL).
  const bySlug = new Map(categories.map((c) => [categorySlug(c.name), c]));
  const selectedCatSlugs = catParams.filter((s) => bySlug.has(s));
  const selectedCatIds = selectedCatSlugs.map((s) => bySlug.get(s)!.id);

  // Nome canônico da cor (a URL pode vir com outra caixa).
  const colorByKey = new Map(
    storeColors.map((c) => [c.name.toLowerCase(), c.name]),
  );
  const selectedColors = colorParams
    .map((n) => colorByKey.get(n.toLowerCase()))
    .filter((n): n is string => !!n);
  const selectedColorSet = new Set(selectedColors.map((c) => c.toLowerCase()));

  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const { items: products, total } = await getProducts({
    categoryIds: selectedCatIds,
    colorNames: selectedColors,
    onlyPromo,
    search: busca,
    sort: ordem,
    page,
  });

  const totalPages = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));
  const activeCount =
    selectedCatSlugs.length + selectedColors.length + (onlyPromo ? 1 : 0);

  const filters = (
    <div className="space-y-7">
      <FilterSection title="Ofertas" selectedCount={onlyPromo ? 1 : 0}>
        <CheckItem
          href={buildHref(
            selectedCatSlugs,
            selectedColors,
            !onlyPromo,
            1,
            busca,
            ordem,
          )}
          checked={onlyPromo}
        >
          Em promoção
        </CheckItem>
      </FilterSection>

      <FilterSection
        title="Categoria"
        selectedCount={selectedCatSlugs.length}
        action={
          selectedCatSlugs.length > 0 ? (
            <Link
              href={buildHref([], selectedColors, onlyPromo, 1, busca, ordem)}
              scroll={false}
              className="text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              limpar
            </Link>
          ) : null
        }
      >
        {categories.map((c) => {
          const slug = categorySlug(c.name);
          const checked = selectedCatSlugs.includes(slug);
          const next = checked
            ? selectedCatSlugs.filter((s) => s !== slug)
            : [...selectedCatSlugs, slug];
          return (
            <CheckItem
              key={c.id}
              href={buildHref(next, selectedColors, onlyPromo, 1, busca, ordem)}
              checked={checked}
            >
              {c.name}
            </CheckItem>
          );
        })}
      </FilterSection>

      {storeColors.length >= 2 && (
        <FilterSection
          title="Cor"
          selectedCount={selectedColors.length}
          action={
            selectedColors.length > 0 ? (
              <Link
                href={buildHref(
                  selectedCatSlugs,
                  [],
                  onlyPromo,
                  1,
                  busca,
                  ordem,
                )}
                scroll={false}
                className="text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
              >
                limpar
              </Link>
            ) : null
          }
        >
          {storeColors.map((c) => {
            const checked = selectedColorSet.has(c.name.toLowerCase());
            const next = checked
              ? selectedColors.filter(
                  (n) => n.toLowerCase() !== c.name.toLowerCase(),
                )
              : [...selectedColors, c.name];
            return (
              <CheckItem
                key={c.name}
                href={buildHref(
                  selectedCatSlugs,
                  next,
                  onlyPromo,
                  1,
                  busca,
                  ordem,
                )}
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
          href="/produtos"
          scroll={false}
          className="inline-block text-sm text-muted underline underline-offset-4 hover:text-foreground"
        >
          Limpar todos os filtros
        </Link>
      )}
    </div>
  );

  const pageLink =
    "flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm transition-colors";

  const chip =
    "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border py-1.5 pl-3 pr-2 text-xs transition-colors hover:border-foreground";
  const chipX = (
    <span aria-hidden className="text-muted">
      ✕
    </span>
  );

  // Chips dos filtros ativos: mostram o que está aplicado e removem com um
  // toque — no celular os filtros ficam recolhidos, então sem os chips o
  // cliente não vê o que está filtrando.
  const activeChips = (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {busca && (
        <Link
          scroll={false}
          href={buildHref(
            selectedCatSlugs,
            selectedColors,
            onlyPromo,
            1,
            "",
            ordem,
          )}
          className={chip}
        >
          “{busca}”{chipX}
        </Link>
      )}
      {onlyPromo && (
        <Link
          scroll={false}
          href={buildHref(
            selectedCatSlugs,
            selectedColors,
            false,
            1,
            busca,
            ordem,
          )}
          className={chip}
        >
          Em promoção{chipX}
        </Link>
      )}
      {selectedCatSlugs.map((s) => (
        <Link
          key={s}
          scroll={false}
          href={buildHref(
            selectedCatSlugs.filter((x) => x !== s),
            selectedColors,
            onlyPromo,
            1,
            busca,
            ordem,
          )}
          className={chip}
        >
          {bySlug.get(s)?.name ?? s}
          {chipX}
        </Link>
      ))}
      {selectedColors.map((c) => (
        <Link
          key={c}
          scroll={false}
          href={buildHref(
            selectedCatSlugs,
            selectedColors.filter((x) => x.toLowerCase() !== c.toLowerCase()),
            onlyPromo,
            1,
            busca,
            ordem,
          )}
          className={chip}
        >
          {displayColor(c)}
          {chipX}
        </Link>
      ))}
      <Link
        scroll={false}
        href="/produtos"
        className="text-xs text-muted underline underline-offset-4 hover:text-foreground"
      >
        limpar tudo
      </Link>
    </div>
  );
  const hasActiveChips = activeCount > 0 || !!busca;

  return (
    <section className="mx-auto max-w-6xl px-6 pb-12 pt-6">
      <header className="mb-6">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">
          Produtos
        </h1>
        <p className="mt-2 text-sm text-muted">
          {total} {total === 1 ? "peça" : "peças"}
          {busca && ` para “${busca}”`}
          {totalPages > 1 &&
            ` · página ${Math.min(page, totalPages)} de ${totalPages}`}
        </p>
      </header>

      <div className="md:grid md:grid-cols-[13rem_1fr] md:gap-10">
        {/* Filtros: lateral no desktop, recolhíveis no topo no mobile */}
        <aside className="mb-8 md:mb-0">
          <FilterDisclosure activeCount={activeCount}>
            {filters}
          </FilterDisclosure>
        </aside>

        <div>
          {/* Busca à esquerda, ordenação à direita — junto dos produtos. */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="min-w-[12rem] flex-1">
              <Suspense fallback={null}>
                <SearchBox />
              </Suspense>
            </div>
            <Suspense fallback={null}>
              <SortSelect value={ordem} />
            </Suspense>
          </div>

          {hasActiveChips && activeChips}

          {products.length === 0 ? (
            <p className="text-muted">Nenhuma peça com esses filtros.</p>
          ) : (
            <>
              {/* Âncora da paginação: `scroll-mt` desconta o header fixo. */}
              <div
                id="lista"
                className="grid scroll-mt-28 grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-3"
              >
                {products.map((p) => (
                  <ProductCard
                    key={p.slug}
                    product={p}
                    isAdmin={isAdmin}
                    isLogged={isLogged}
                    isFavorite={favorites.has(p.id)}
                    backTo={buildHref(
                      selectedCatSlugs,
                      selectedColors,
                      onlyPromo,
                      page,
                      busca,
                      ordem,
                    )}
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
                      href={`${buildHref(
                        selectedCatSlugs,
                        selectedColors,
                        onlyPromo,
                        page - 1,
                        busca,
                        ordem,
                      )}#lista`}
                      aria-label="Página anterior"
                      className={`${pageLink} border-border text-muted hover:border-foreground hover:text-foreground`}
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
                        key={p}
                        href={`${buildHref(
                          selectedCatSlugs,
                          selectedColors,
                          onlyPromo,
                          p,
                          busca,
                          ordem,
                        )}#lista`}
                        aria-label={`Página ${p}`}
                        aria-current={p === page ? "page" : undefined}
                        className={`${pageLink} ${
                          p === page
                            ? "border-foreground bg-foreground font-medium text-background"
                            : "border-border text-muted hover:border-foreground hover:text-foreground"
                        }`}
                      >
                        {p}
                      </Link>
                    ),
                  )}

                  {page < totalPages && (
                    <Link
                      href={`${buildHref(
                        selectedCatSlugs,
                        selectedColors,
                        onlyPromo,
                        page + 1,
                        busca,
                        ordem,
                      )}#lista`}
                      aria-label="Próxima página"
                      className={`${pageLink} border-border text-muted hover:border-foreground hover:text-foreground`}
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
