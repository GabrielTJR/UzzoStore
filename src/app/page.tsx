import Link from "next/link";
import { getProducts } from "@/lib/products";
import { ProductCard } from "@/components/product-card";
import { getAdminUser } from "@/lib/admin";

export default async function Home() {
  const [featured, adminUser] = await Promise.all([
    getProducts({ featured: true }),
    getAdminUser(),
  ]);
  const isAdmin = !!adminUser;

  return (
    <>
      <section className="mx-auto flex min-h-[68vh] max-w-6xl flex-col justify-center px-6 py-20">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-muted">
          Moda masculina · Balneário Camboriú
        </p>
        <h1 className="mt-6 max-w-4xl font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Tecnologia aplicada ao vestir.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Conforto, praticidade e elegância — com envio para todo o Brasil.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link
            href="/produtos"
            className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Ver produtos
          </Link>
          <a
            href="https://www.instagram.com/uzzostorebc/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-full border border-border px-8 text-sm font-medium transition-colors hover:border-foreground"
          >
            @uzzostorebc
          </a>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="font-serif text-3xl font-semibold tracking-tight">
              Destaques
            </h2>
            <Link
              href="/produtos"
              className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              Ver todos
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.slug} product={p} isAdmin={isAdmin} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
