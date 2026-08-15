"use client";

import { useEffect, useState } from "react";
import { useCart, cartCount } from "@/lib/cart-store";
import { useCartUi } from "@/lib/cart-ui";

/** Ícone da sacola no header — abre a GAVETA (não navega mais para /sacola:
 * no celular, sair da página para conferir a sacola quebrava o fluxo). */
export function CartButton() {
  const items = useCart((s) => s.items);
  const openCart = useCartUi((s) => s.openCart);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const count = mounted ? cartCount(items) : 0;

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label="Abrir sacola"
      className="relative -m-2 inline-flex items-center p-2 text-muted transition-colors hover:text-foreground"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      {mounted && count > 0 && (
        <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[0.6rem] font-semibold text-background">
          {count}
        </span>
      )}
    </button>
  );
}
