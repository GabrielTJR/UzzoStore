import Link from "next/link";
import { FeaturedStar } from "./featured-star";

const overlayButton =
  "flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm backdrop-blur transition duration-150 ease-out hover:scale-110 hover:bg-background active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40";

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

/**
 * Atalhos de admin sobrepostos no canto superior direito de uma foto de produto:
 * estrela (liga/desliga destaque na home) + lápis (vai para a edição). O pai
 * precisa ser `position: relative`. Renderize apenas quando o usuário é admin.
 */
export function AdminProductOverlay({
  productId,
  featured,
}: {
  productId: string;
  featured: boolean;
}) {
  return (
    <div className="absolute right-2 top-2 z-10 flex gap-1.5">
      <FeaturedStar productId={productId} featured={featured} />
      <Link
        href={`/admin/produtos/${productId}`}
        title="Editar produto"
        aria-label="Editar produto"
        className={overlayButton}
      >
        <PencilIcon />
      </Link>
    </div>
  );
}
