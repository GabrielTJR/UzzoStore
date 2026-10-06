"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleWishlistAction } from "@/app/(loja)/produtos/wishlist-actions";
import { useViewer } from "@/lib/viewer";

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
 *
 * Logado e favoritos vêm do `useViewer` (navegador), não de props do servidor:
 * é o que deixa as páginas da vitrine estáticas. O estado é compartilhado, então
 * o mesmo produto em dois lugares da tela (card e relacionados) acende junto.
 */
export function WishlistHeart({
  productId,
  backTo = "/produtos",
  className = "",
}: {
  productId: string;
  backTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const ready = useViewer((s) => s.ready);
  const logged = useViewer((s) => s.logged);
  const favorite = useViewer((s) => s.favorites.includes(productId));
  const setFavorite = useViewer((s) => s.setFavorite);
  const [, startTransition] = useTransition();

  function handleClick() {
    // Ainda descobrindo quem é (logado, com a chamada em voo): mandar para o
    // login quem já está logado seria pior que ignorar um toque.
    if (!ready) return;
    if (!logged) {
      router.push(`/entrar?next=${encodeURIComponent(backTo)}`);
      return;
    }
    const next = !favorite;
    setFavorite(productId, next); // otimista
    startTransition(async () => {
      const res = await toggleWishlistAction(productId, next);
      if (!res.ok) setFavorite(productId, !next); // desfaz se o servidor recusou
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
