import Link from "next/link";
import type { Metadata } from "next";
import { requireCustomer } from "@/lib/customer";
import { getWishlistIds } from "@/lib/wishlist";
import { getProducts } from "@/lib/products";
import { ProductCard } from "@/components/product-card";

export const metadata: Metadata = { title: "Meus favoritos" };

const tab =
  "rounded-full border border-border px-4 py-1.5 text-sm text-muted transition-colors hover:border-foreground hover:text-foreground";

export default async function FavoritosPage() {
  await requireCustomer("/conta/favoritos");
  const ids = await getWishlistIds();
  const { items } = await getProducts({
    productIds: [...ids],
    page: 1,
    perPage: 48,
  });

  return (
    <section className="mx-auto max-w-5xl space-y-8 px-6 py-12">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Meus favoritos
        </h1>
        <p className="mt-1 text-sm text-muted">
          As peças que você salvou para ver depois.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        <Link href="/conta" className={tab}>
          Dados
        </Link>
        <Link href="/conta/enderecos" className={tab}>
          Endereços
        </Link>
        <Link href="/conta/pedidos" className={tab}>
          Pedidos
        </Link>
        <span className="rounded-full border border-foreground bg-foreground px-4 py-1.5 text-sm font-medium text-background">
          Favoritos
        </span>
      </nav>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted">
          <p>Você ainda não salvou nenhuma peça.</p>
          <p className="mt-1">
            Toque no ♥ em cima da foto para guardar o que gostar.
          </p>
          <Link
            href="/produtos"
            className="mt-3 inline-block underline underline-offset-4 hover:text-foreground"
          >
            Ver produtos
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard
              key={p.slug}
              product={p}
              isLogged
              isFavorite
              backTo="/conta/favoritos"
            />
          ))}
        </div>
      )}
    </section>
  );
}
