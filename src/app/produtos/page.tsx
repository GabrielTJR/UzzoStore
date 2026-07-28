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

/** Monta a URL de /produtos preservando categoria + cores selecionadas. */
function buildHref(categoria: string | undefined, cores: string[]): string {
  const params = new URLSearchParams();
  if (categoria) params.set("categoria", categoria);
  if (cores.length) params.set("cores", cores.join(","));
  const qs = params.toString();
  return qs ? `/produtos?${qs}` : "/produtos";
}

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; cores?: string | string[] }>;
}) {
  const sp = await searchParams;
  const categoriaParam = typeof sp.categoria === "string" ? sp.categoria : undefined;
  const coresRaw = Array.isArray(sp.cores) ? sp.cores.join(",") : (sp.cores ?? "");
  const selectedColors = coresRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const selectedColorSet = new Set(selectedColors.map((c) => c.toLowerCase()));

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

  // Cores distintas presentes no catálogo (para os chips do filtro).
  const colorMap = new Map<string, { name: string; hex: string | null }>();
  for (const p of all) {
    for (const c of p.colors) {
      const k = c.name.toLowerCase();
      if (!colorMap.has(k)) colorMap.set(k, { name: c.name, hex: c.hex });
    }
  }
  const catalogColors = [...colorMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  let products = selectedCategory
    ? all.filter((p) => p.category === selectedCategory.name)
    : all;
  if (selectedColorSet.size > 0) {
    products = products.filter((p) =>
      p.colors.some((c) => selectedColorSet.has(c.name.toLowerCase())),
    );
  }

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
        {/* Categorias */}
        <div className="flex flex-wrap gap-2">
          <FilterChip
            href={buildHref(undefined, selectedColors)}
            active={!selectedCategory}
          >
            Todos
          </FilterChip>
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              href={buildHref(categorySlug(c.name), selectedColors)}
              active={selectedCategory?.id === c.id}
            >
              {c.name}
            </FilterChip>
          ))}
        </div>

        {/* Filtro por cor */}
        {catalogColors.length >= 2 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted">
              Cor
            </span>
            <FilterChip
              href={buildHref(activeCatSlug, [])}
              active={selectedColors.length === 0}
            >
              Geral
            </FilterChip>
            {catalogColors.map((cc) => {
              const isSel = selectedColorSet.has(cc.name.toLowerCase());
              const next = isSel
                ? selectedColors.filter(
                    (n) => n.toLowerCase() !== cc.name.toLowerCase(),
                  )
                : [...selectedColors, cc.name];
              return (
                <Link
                  key={cc.name}
                  href={buildHref(activeCatSlug, next)}
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
