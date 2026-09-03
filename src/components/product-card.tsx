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

export function ProductCard({
  product,
  isAdmin = false,
  isLogged = false,
  isFavorite = false,
  backTo = "/produtos",
}: {
  product: ProductListItem;
  isAdmin?: boolean;
  isLogged?: boolean;
  isFavorite?: boolean;
  backTo?: string;
}) {
  const off = discountPercent(product);
  const parcelas = installmentsFor(product.price);

  return (
    <div className="group relative">
      <CardColorMedia
        product={product}
        badge={
          off != null ? (
            <span className="absolute bottom-2 left-2 z-10 rounded-full bg-foreground px-2 py-0.5 text-[0.65rem] font-semibold text-background">
              −{off}%
            </span>
          ) : null
        }
      />

      {/* Favorito à esquerda; os atalhos de admin ficam à direita. */}
      <div className="absolute left-2 top-2 z-10">
        <WishlistHeart
          productId={product.id}
          initialFavorite={isFavorite}
          isLogged={isLogged}
          backTo={backTo}
        />
      </div>

      <Link href={`/produtos/${product.slug}`} className="mt-3 block space-y-1">
        {product.category && (
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-muted">
            {product.category}
          </p>
        )}
        <h3 className="text-sm font-medium leading-snug">{product.name}</h3>
        {product.price != null && (
          <div>
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className={product.onPromo ? "font-medium" : "text-muted"}>
                {formatBRL(product.price)}
              </span>
              {product.onPromo && product.basePrice != null && (
                <span className="text-xs text-muted line-through">
                  {formatBRL(product.basePrice)}
                </span>
              )}
            </p>
            {parcelas && (
              <p className="text-xs text-muted">
                {parcelas.count}x de {formatBRL(parcelas.value)}
                {parcelas.semJuros ? " sem juros" : ""}
              </p>
            )}
          </div>
        )}
      </Link>

      {isAdmin && (
        <AdminProductOverlay
          productId={product.id}
          featured={product.featured}
        />
      )}
    </div>
  );
}
