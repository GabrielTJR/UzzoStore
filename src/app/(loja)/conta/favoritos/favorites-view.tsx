import type { ProductListItem } from "@/lib/products";
import { ProductCard } from "@/components/product-card";
import { AccountHeading } from "../account-shell";
import { IconHeart } from "@/components/icons";
import { EmptyState } from "../pedidos/order-ui";

/** A mesma grade de cards da loja, mas COM o coração (`showWishlist`): é a
 * única tela onde o card o mostra, porque aqui ele é o jeito de tirar a peça da
 * lista. `backTo` sempre repassado — sem ele o coração mandaria o cliente
 * logado para /conta. */
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
          Icon={IconHeart}
          title="Nenhuma peça salva"
          text="Abra uma peça e toque no coração ao lado do nome para guardar o que gostar e voltar depois."
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => (
            <ProductCard
              key={p.slug}
              product={p}
              backTo="/conta/favoritos"
              showWishlist
            />
          ))}
        </div>
      )}
    </>
  );
}
