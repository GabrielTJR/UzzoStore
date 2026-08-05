import Link from "next/link";
import type { Metadata } from "next";
import { getProducts, getCategories } from "@/lib/products";
import { ProductCard } from "@/components/product-card";
import { FilterDisclosure } from "@/components/filter-disclosure";
import { FilterSection } from "@/components/filter-section";
import { categorySlug } from "@/lib/categories";
import { getAdminUser } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Produtos",
  description: "Peças da Uzzo Store — moda masculina em Balneário Camboriú.",
};

/** Monta a URL de /produtos com os filtros ativos. */
function buildHref(
  categorias: string[],
  cores: string[],
  promo: boolean,
): string {
  const params = new URLSearchParams();
  if (categorias.length) params.set("categorias", categorias.join(","));
  if (cores.length) params.set("cores", cores.join(","));
  if (promo) params.set("promo", "1");
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

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{
    categoria?: string | string[];
    categorias?: string | string[];
    cores?: string | string[];
    promo?: string | string[];
  }>;
}) {
  const sp = await searchParams;
  // `categoria` (singular) mantido por compatibilidade com links antigos.
  const catParams = [...csv(sp.categorias), ...csv(sp.categoria)];
  const selectedColors = csv(sp.cores);
  const onlyPromo = Array.isArray(sp.promo)
    ? sp.promo.includes("1")
    : sp.promo === "1";

  const [all, categories, adminUser] = await Promise.all([
    getProducts(),
    getCategories(),
    getAdminUser(),
  ]);
  const isAdmin = !!adminUser;

  // Slugs válidos (ignora categoria inexistente na URL).
  const bySlug = new Map(categories.map((c) => [categorySlug(c.name), c]));
  const selectedCatSlugs = catParams.filter((s) => bySlug.has(s));
  const selectedCatNames = new Set(
    selectedCatSlugs.map((s) => bySlug.get(s)!.name),
  );

  // Base = categorias selecionadas (nenhuma = todas) + promoção.
  const byCategory = selectedCatNames.size
    ? all.filter((p) => p.category && selectedCatNames.has(p.category))
    : all;
  const base = onlyPromo ? byCategory.filter((p) => p.onPromo) : byCategory;

  // Cores disponíveis SÓ nessa base — filtro facetado.
  const colorMap = new Map<string, string>();
  for (const p of base) {
    for (const c of p.colors) {
      const k = c.name.toLowerCase();
      if (!colorMap.has(k)) colorMap.set(k, c.name);
    }
  }
  const catalogColors = [...colorMap.values()].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
  );
  const catalogKeys = new Set(catalogColors.map((c) => c.toLowerCase()));
  const effectiveColors = selectedColors.filter((n) =>
    catalogKeys.has(n.toLowerCase()),
  );
  const effectiveColorSet = new Set(effectiveColors.map((c) => c.toLowerCase()));

  const products =
    effectiveColorSet.size > 0
      ? base.filter((p) =>
          p.colors.some((c) => effectiveColorSet.has(c.name.toLowerCase())),
        )
      : base;

  const activeCount =
    selectedCatSlugs.length + effectiveColors.length + (onlyPromo ? 1 : 0);

  const filters = (
    <div className="space-y-7">
      <FilterSection title="Ofertas" selectedCount={onlyPromo ? 1 : 0}>
        <CheckItem
          href={buildHref(selectedCatSlugs, effectiveColors, !onlyPromo)}
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
              href={buildHref([], effectiveColors, onlyPromo)}
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
              href={buildHref(next, effectiveColors, onlyPromo)}
              checked={checked}
            >
              {c.name}
            </CheckItem>
          );
        })}
      </FilterSection>

      {catalogColors.length >= 2 && (
        <FilterSection
          title="Cor"
          selectedCount={effectiveColors.length}
          action={
            effectiveColors.length > 0 ? (
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
          {catalogColors.map((name) => {
            const checked = effectiveColorSet.has(name.toLowerCase());
            const next = checked
              ? effectiveColors.filter(
                  (n) => n.toLowerCase() !== name.toLowerCase(),
                )
              : [...effectiveColors, name];
            return (
              <CheckItem
                key={name}
                href={buildHref(selectedCatSlugs, next, onlyPromo)}
                checked={checked}
              >
                {displayColor(name)}
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

  return (
    <section className="mx-auto max-w-6xl px-6 pb-12 pt-6">
      <header className="mb-6">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">
          Produtos
        </h1>
        <p className="mt-2 text-sm text-muted">
          {products.length} {products.length === 1 ? "peça" : "peças"}
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
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.slug} product={p} isAdmin={isAdmin} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
