"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toggleFeaturedAction, type ActionResult } from "@/app/admin/actions";
import { useToast } from "@/components/toast";

const overlayButton =
  "flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm backdrop-blur transition duration-150 ease-out hover:scale-110 hover:bg-background active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 disabled:pointer-events-none disabled:opacity-70";

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      className={filled ? "text-amber-500" : "text-muted"}
      aria-hidden
    >
      <path d="M12 3l2.7 5.47 6.04.88-4.37 4.26 1.03 6.02L12 17.77 6.6 19.63l1.03-6.02L3.26 9.35l6.04-.88L12 3z" />
    </svg>
  );
}

function StarButton({ featured }: { featured: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      title={featured ? "Remover destaque da home" : "Destacar na home"}
      aria-label={
        featured ? "Remover destaque da home" : "Marcar como destaque na home"
      }
      className={overlayButton}
    >
      <span className={pending ? "animate-pulse" : "transition-transform"}>
        <StarIcon filled={featured} />
      </span>
    </button>
  );
}

export function FeaturedStar({
  productId,
  featured,
}: {
  productId: string;
  featured: boolean;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    toggleFeaturedAction,
    null,
  );
  const { showToast } = useToast();

  useEffect(() => {
    if (!state) return;
    if (state.ok) showToast("Destaque atualizado");
    else if (state.error) showToast(state.error, "error");
  }, [state, showToast]);

  return (
    <form action={action}>
      <input type="hidden" name="productId" value={productId} />
      <StarButton featured={featured} />
    </form>
  );
}
