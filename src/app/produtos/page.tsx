import Link from "next/link";
import type { Metadata } from "next";
import { getProducts, getCategories } from "@/lib/products";
import { ProductCard } from "@/components/product-card";
import { categorySlug } from "@/lib/categories";
import { getAdminUser } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Produtos",
  description: "Peças da Uzzo Store — moda masculina em Balneário Camboriú.",
};

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted hover:border-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

/** Monta a URL de /produtos preservando categoria + cores + promoção. */
function buildHref(
  categoria: string | undefined,
  cores: string[],
  promo: boolean,
): string {
  const params = new URLSearchParams();
  if (categoria) params.set("categoria", categoria);
  if (cores.length) params.set("cores", cores.join(","));
  if (promo) params.set("promo", "1");
  const qs = params.toString();
  return qs ? `/produtos?${qs}` : "/produtos";
}

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{
    categoria?: string;
    cores?: string | string[];
    promo?: string | string[];
  }>;
}) {
  const sp = await searchParams;
  const categoriaParam =
    typeof sp.categoria === "string" ? sp.categoria : undefined;
  const coresRaw = Array.isArray(sp.cores) ? sp.cores.join(",") : (sp.cores ?? "");
  const selectedColors = coresRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const onlyPromo = Array.isArray(sp.promo)
    ? sp.promo.includes("1")
    : sp.promo === "1";

  const [all, categories, adminUser] = await Promise.all([
    getProducts(),
    getCategories(),
    getAdminUser(),
  ]);
  const isAdmin = !!adminUser;

  const selectedCategory = categoriaParam
    ? (categories.find((c) => categorySlug(c.name) === categoriaParam) ?? null)
    : null;
  const activeCatSlug = selectedCategory
    ? categorySlug(selectedCategory.name)
    : undefined;

  // Base = produtos da categoria; a promoção é o outro filtro "não-cor".
  const byCategory = selectedCategory
    ? all.filter((p) => p.category === selectedCategory.name)
    : all;
  const hasPromoInCategory = byCategory.some((p) => p.onPromo);
  const showPromo = hasPromoInCategory || onlyPromo;
  const base = onlyPromo ? byCategory.filter((p) => p.onPromo) : byCategory;

  // Cores disponíveis SÓ nessa base (categoria + promoção) — filtro facetado.
  const colorMap = new Map<string, { name: string; hex: string | null }>();
  for (const p of base) {
    for (const c of p.colors) {
      const k = c.name.toLowerCase();
      if (!colorMap.has(k)) colorMap.set(k, { name: c.name, hex: c.hex });
    }
  }
  const catalogColors = [...colorMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const catalogKeys = new Set(catalogColors.map((c) => c.name.toLowerCase()));

  // Só as cores selecionadas que existem na base (ignora cores de outra categoria).
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

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">
          {selectedCategory ? selectedCategory.name : "Todos os produtos"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {products.length} {products.length === 1 ? "peça" : "peças"}
        </p>
      </header>

      <div className="mb-10 space-y-3">
        {/* Categorias + promoção */}
        <div className="flex flex-wrap gap-2">
          <FilterChip
            href={buildHref(undefined, effectiveColors, onlyPromo)}
            active={!selectedCategory}
          >
            Todos
          </FilterChip>
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              href={buildHref(categorySlug(c.name), effectiveColors, onlyPromo)}
              active={selectedCategory?.id === c.id}
            >
              {c.name}
            </FilterChip>
          ))}
          {showPromo && (
            <FilterChip
              href={buildHref(activeCatSlug, effectiveColors, !onlyPromo)}
              active={onlyPromo}
            >
              🏷️ Em promoção
            </FilterChip>
          )}
        </div>

        {/* Filtro por cor (só as cores existentes na base) */}
        {catalogColors.length >= 2 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm font-medium text-muted">Cor:</span>
            {catalogColors.map((cc) => {
              const isSel = effectiveColorSet.has(cc.name.toLowerCase());
              const next = isSel
                ? effectiveColors.filter(
                    (n) => n.toLowerCase() !== cc.name.toLowerCase(),
                  )
                : [...effectiveColors, cc.name];
              return (
                <Link
                  key={cc.name}
                  href={buildHref(activeCatSlug, next, onlyPromo)}
                  title={cc.name}
                  aria-label={`Filtrar por cor ${cc.name}`}
                  className={`h-7 w-7 rounded-full border transition duration-150 ease-out ${
                    isSel
                      ? "border-foreground ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : "border-border hover:scale-110"
                  }`}
                  style={
                    cc.hex
                      ? { backgroundColor: cc.hex }
                      : {
                          backgroundImage:
                            "repeating-linear-gradient(45deg, var(--color-border, #ccc) 0 3px, transparent 3px 6px)",
                        }
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {products.length === 0 ? (
        <p className="text-muted">Nenhuma peça com esses filtros.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.slug} product={p} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </section>
  );
}
