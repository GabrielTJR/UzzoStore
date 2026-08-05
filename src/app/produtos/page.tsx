import Link from "next/link";
import type { Metadata } from "next";
import {
  getProducts,
  getCategories,
  getStoreColors,
  PRODUCTS_PER_PAGE,
} from "@/lib/products";
import { ProductCard } from "@/components/product-card";
import { FilterDisclosure } from "@/components/filter-disclosure";
import { FilterSection } from "@/components/filter-section";
import { categorySlug } from "@/lib/categories";
import { getAdminUser } from "@/lib/admin";

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
): string {
  const params = new URLSearchParams();
  if (categorias.length) params.set("categorias", categorias.join(","));
  if (cores.length) params.set("cores", cores.join(","));
  if (promo) params.set("promo", "1");
  if (pagina > 1) params.set("pagina", String(pagina));
  const qs = params.toString();
  return qs ? `/produtos?${qs}` : "/produtos";
}

/** Item de filtro em formato checkbox (navega por URL, sem JS). */
function CheckItem({
  href,
  checked,
  children,
}: {
  href: string;
  checked: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={`${checked ? "Remover filtro" : "Filtrar por"} ${String(children)}`}
      className="group flex items-center gap-2.5 py-1.5 text-sm transition-colors hover:text-foreground"
    >
      <span
        aria-hidden
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none transition-colors ${
          checked
            ? "border-foreground bg-foreground text-background"
            : "border-border group-hover:border-foreground"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
      <span className={checked ? "font-medium" : "text-muted"}>{children}</span>
    </Link>
  );
}

/** Exibição do nome da cor (o cadastro tem caixa inconsistente: "BEGE", "Cinza"). */
function displayColor(name: string): string {
  return name
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s|-)([\p{L}])/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase("pt-BR"));
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
  if (total <= 7)
    return Array.from({ length: total }, (_, i) => i + 1);
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
    pagina?: string | string[];
  }>;
}) {
  const sp = await searchParams;
  // `categoria` (singular) mantido por compatibilidade com links antigos.
  const catParams = [...csv(sp.categorias), ...csv(sp.categoria)];
  const colorParams = csv(sp.cores);
  const onlyPromo = Array.isArray(sp.promo)
    ? sp.promo.includes("1")
    : sp.promo === "1";
  const pageParam = parseInt(
    Array.isArray(sp.pagina) ? (sp.pagina[0] ?? "1") : (sp.pagina ?? "1"),
    10,
  );

  const [categories, storeColors, adminUser] = await Promise.all([
    getCategories(),
    getStoreColors(),
    getAdminUser(),
  ]);
  const isAdmin = !!adminUser;

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
    page,
  });

  const totalPages = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));
  const activeCount =
    selectedCatSlugs.length + selectedColors.length + (onlyPromo ? 1 : 0);

  const filters = (
    <div className="space-y-7">
      <FilterSection title="Ofertas" selectedCount={onlyPromo ? 1 : 0}>
        <CheckItem
          href={buildHref(selectedCatSlugs, selectedColors, !onlyPromo)}
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
              href={buildHref([], selectedColors, onlyPromo)}
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
              href={buildHref(next, selectedColors, onlyPromo)}
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
                href={buildHref(selectedCatSlugs, [], onlyPromo)}
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
                href={buildHref(selectedCatSlugs, next, onlyPromo)}
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

  return (
    <section className="mx-auto max-w-6xl px-6 pb-12 pt-6">
      <header className="mb-6">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">
          Produtos
        </h1>
        <p className="mt-2 text-sm text-muted">
          {total} {total === 1 ? "peça" : "peças"}
          {totalPages > 1 && ` · página ${Math.min(page, totalPages)} de ${totalPages}`}
        </p>
      </header>

      <div className="md:grid md:grid-cols-[13rem_1fr] md:gap-10">
        {/* Filtros: lateral no desktop, recolhíveis no topo no mobile */}
        <aside className="mb-8 md:mb-0">
          <FilterDisclosure activeCount={activeCount}>{filters}</FilterDisclosure>
        </aside>

        <div>
          {products.length === 0 ? (
            <p className="text-muted">Nenhuma peça com esses filtros.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-3">
                {products.map((p) => (
                  <ProductCard key={p.slug} product={p} isAdmin={isAdmin} />
                ))}
              </div>

              {totalPages > 1 && (
                <nav
                  aria-label="Paginação"
                  className="mt-12 flex flex-wrap items-center justify-center gap-2"
                >
                  {page > 1 && (
                    <Link
                      href={buildHref(
                        selectedCatSlugs,
                        selectedColors,
                        onlyPromo,
                        page - 1,
                      )}
                      scroll={false}
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
                        href={buildHref(
                          selectedCatSlugs,
                          selectedColors,
                          onlyPromo,
                          p,
                        )}
                        scroll={false}
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
                      href={buildHref(
                        selectedCatSlugs,
                        selectedColors,
                        onlyPromo,
                        page + 1,
                      )}
                      scroll={false}
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
