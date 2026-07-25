import Link from "next/link";
import { formatBRL } from "@/lib/format";
import { ProductPlaceholder } from "./product-placeholder";
import type { ProductListItem } from "@/lib/products";

export function ProductCard({ product }: { product: ProductListItem }) {
  return (
    <Link href={`/produtos/${product.slug}`} className="group block">
      <div className="overflow-hidden rounded-lg border border-border transition-opacity group-hover:opacity-90">
        <ProductPlaceholder />
      </div>
      <div className="mt-3 space-y-1">
        {product.category && (
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-muted">
            {product.category}
          </p>
        )}
        <h3 className="text-sm font-medium leading-snug">{product.name}</h3>
        {product.price != null && (
          <p className="text-sm text-muted">{formatBRL(product.price)}</p>
        )}
      </div>
    </Link>
  );
}
