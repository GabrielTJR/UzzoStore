import Link from "next/link";
import Image from "next/image";
import { formatBRL } from "@/lib/format";
import { ProductPlaceholder } from "./product-placeholder";
import { FeaturedStar } from "./featured-star";
import type { ProductListItem } from "@/lib/products";

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-foreground"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

const overlayButton =
  "flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm backdrop-blur transition duration-150 ease-out hover:scale-110 hover:bg-background active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40";

export function ProductCard({
  product,
  isAdmin = false,
}: {
  product: ProductListItem;
  isAdmin?: boolean;
}) {
  return (
    <div className="group relative">
      <Link href={`/produtos/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border transition-opacity group-hover:opacity-90">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
            />
          ) : (
            <ProductPlaceholder />
          )}
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

      {isAdmin && (
        <div className="absolute right-2 top-2 z-10 flex gap-1.5">
          <FeaturedStar productId={product.id} featured={product.featured} />
          <Link
            href={`/admin/produtos/${product.id}`}
            title="Editar produto"
            aria-label="Editar produto"
            className={overlayButton}
          >
            <PencilIcon />
          </Link>
        </div>
      )}
    </div>
  );
}
