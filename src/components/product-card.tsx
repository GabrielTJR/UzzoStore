import Link from "next/link";
import { formatBRL } from "@/lib/format";
import { CardColorMedia } from "./card-color-media";
import { AdminProductOverlay } from "./admin-product-overlay";
import type { ProductListItem } from "@/lib/products";

export function ProductCard({
  product,
  isAdmin = false,
}: {
  product: ProductListItem;
  isAdmin?: boolean;
}) {
  return (
    <div className="group relative">
      <CardColorMedia product={product} />

      <Link href={`/produtos/${product.slug}`} className="mt-3 block space-y-1">
        {product.category && (
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-muted">
            {product.category}
          </p>
        )}
        <h3 className="text-sm font-medium leading-snug">{product.name}</h3>
        {product.price != null && (
          <p className="text-sm text-muted">{formatBRL(product.price)}</p>
        )}
      </Link>

      {isAdmin && (
        <AdminProductOverlay productId={product.id} featured={product.featured} />
      )}
    </div>
  );
}
