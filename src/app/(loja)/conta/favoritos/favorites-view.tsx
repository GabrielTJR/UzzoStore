import type { ProductListItem } from "@/lib/products";
import { ProductCard } from "@/components/product-card";
import { AccountHeading } from "../account-shell";
import { EmptyState } from "../pedidos/order-ui";

/** A mesma grade de cards da loja. `isLogged`/`isFavorite`/`backTo` sempre
 * repassados — sem eles o coração mandaria o cliente logado para /conta. */
export function FavoritesView({ items }: { items: ProductListItem[] }) {
  return (
    <>
      <AccountHeading
        title="Favoritos"
        description={
          items.length
            ? `${items.length} ${items.length === 1 ? "peça salva" : "peças salvas"}`
            : undefined
        }
      />
      {items.length === 0 ? (
        <EmptyState
          title="Nenhuma peça salva"
          text="Toque no coração em cima da foto para guardar o que gostar e voltar depois."
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.slug} product={p} backTo="/conta/favoritos" />
          ))}
        </div>
      )}
    </>
  );
}
