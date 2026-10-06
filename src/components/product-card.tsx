import Link from "next/link";
import { formatBRL } from "@/lib/format";
import { installmentsFor } from "@/lib/installments";
import { CardColorMedia } from "./card-color-media";
import { AdminProductOverlay } from "./admin-product-overlay";
import { WishlistHeart } from "./wishlist-heart";
import type { ProductListItem } from "@/lib/products";

/** Desconto arredondado (−23%) — só mostra a partir de 5% para o selo não
 * aparecer com "−1%" em ajustes pequenos de preço. */
function discountPercent(product: ProductListItem): number | null {
  if (!product.onPromo || product.price == null || product.basePrice == null)
    return null;
  if (product.basePrice <= 0) return null;
  const pct = Math.round((1 - product.price / product.basePrice) * 100);
  return pct >= 5 ? pct : null;
}

/**
 * Card de produto. A foto ocupa quase tudo; embaixo, na ordem em que o cliente
 * decide: cores disponíveis, nome, preço, parcela.
 *
 * O selo de desconto é o único ponto de cor (cobalto) — mesma cor das etiquetas
 * do hero, o "sinal" da loja. A categoria saiu do card: na listagem ela já está
 * no filtro e no título, e repetida em cada peça era só ruído.
 */
export function ProductCard({
  product,
  backTo = "/produtos",
}: {
  product: ProductListItem;
  backTo?: string;
}) {
  const off = discountPercent(product);
  const parcelas = installmentsFor(product.price);

  return (
    <div className="group relative">
      <CardColorMedia
        product={product}
        badge={
          product.esgotado ? (
            <span className="absolute bottom-2 left-2 z-10 rounded-xs bg-foreground px-1.5 py-1 text-[0.7rem] font-bold leading-none text-background">
              Esgotado
            </span>
          ) : off != null ? (
            <span className="absolute bottom-2 left-2 z-10 rounded-xs bg-accent px-1.5 py-1 text-[0.7rem] font-bold leading-none text-accent-foreground">
              −{off}%
            </span>
          ) : null
        }
      />

      {/* Favorito à esquerda; os atalhos de admin ficam à direita. */}
      <div className="absolute left-2 top-2 z-10">
        <WishlistHeart productId={product.id} backTo={backTo} />
      </div>

      <Link href={`/produtos/${product.slug}`} className="mt-2.5 block">
        <h3 className="text-sm font-medium leading-snug">{product.name}</h3>
        {product.price != null && (
          <>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-bold">{formatBRL(product.price)}</span>
              {product.onPromo && product.basePrice != null && (
                <span className="text-xs text-muted line-through">
                  {formatBRL(product.basePrice)}
                </span>
              )}
            </p>
            {parcelas && (
              <p className="mt-0.5 text-xs text-muted">
                {parcelas.count}x de {formatBRL(parcelas.value)}
                {parcelas.semJuros ? " sem juros" : ""}
              </p>
            )}
          </>
        )}
      </Link>

      <AdminProductOverlay productId={product.id} featured={product.featured} />
    </div>
  );
}
