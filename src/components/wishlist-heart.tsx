"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleWishlistAction } from "@/app/produtos/wishlist-actions";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={filled ? "text-red-500" : "text-foreground"}
      aria-hidden
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

/**
 * Coração de favorito. O clique responde na hora (estado otimista) e só depois
 * confirma no servidor — a ida ao banco leva ~200ms e travar o botão nesse
 * tempo faz o site parecer lento. Se falhar, volta ao estado anterior.
 * Visitante sem conta é levado para o login, guardando de onde veio.
 */
export function WishlistHeart({
  productId,
  initialFavorite,
  isLogged,
  backTo = "/produtos",
  className = "",
}: {
  productId: string;
  initialFavorite: boolean;
  isLogged: boolean;
  backTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [favorite, setFavorite] = useState(initialFavorite);
  const [, startTransition] = useTransition();

  function handleClick() {
    if (!isLogged) {
      router.push(`/entrar?next=${encodeURIComponent(backTo)}`);
      return;
    }
    const next = !favorite;
    setFavorite(next); // otimista
    startTransition(async () => {
      const res = await toggleWishlistAction(productId, next);
      if (!res.ok) setFavorite(!next); // desfaz se o servidor recusou
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={favorite}
      title={favorite ? "Remover dos favoritos" : "Salvar nos favoritos"}
      aria-label={favorite ? "Remover dos favoritos" : "Salvar nos favoritos"}
      className={`flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/90 shadow-sm backdrop-blur transition duration-150 ease-out hover:scale-110 hover:bg-background active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 ${className}`}
    >
      <HeartIcon filled={favorite} />
    </button>
  );
}
