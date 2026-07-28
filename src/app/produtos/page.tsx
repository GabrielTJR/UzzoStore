import Link from "next/link";
import type { Metadata } from "next";
import { getProducts } from "@/lib/products";
import { ProductCard } from "@/components/product-card";
import { CATEGORIES } from "@/lib/categories";
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

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
  const selected = CATEGORIES.find((c) => c.slug === categoria) ?? null;
  const [all, adminUser] = await Promise.all([getProducts(), getAdminUser()]);
  const isAdmin = !!adminUser;
  const products = selected
    ? all.filter((p) => p.category === selected.name)
    : all;

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">
          {selected ? selected.name : "Todos os produtos"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {products.length} {products.length === 1 ? "peça" : "peças"}
        </p>
      </header>

      <div className="mb-10 flex flex-wrap gap-2">
        <FilterChip href="/produtos" active={!selected}>
          Todos
        </FilterChip>
        {CATEGORIES.map((c) => (
          <FilterChip
            key={c.slug}
            href={`/produtos?categoria=${c.slug}`}
            active={selected?.slug === c.slug}
          >
            {c.name}
          </FilterChip>
        ))}
      </div>

      {products.length === 0 ? (
        <p className="text-muted">Nenhuma peça nesta categoria por enquanto.</p>
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
