"use client";

import { useEffect, useRef, useState } from "react";
import { useCart, cartCount } from "@/lib/cart-store";
import { useCartUi } from "@/lib/cart-ui";
import { IconBag } from "@/components/icons";

/** Ícone da sacola no header — abre a GAVETA (não navega mais para /sacola:
 * no celular, sair da página para conferir a sacola quebrava o fluxo). */
export function CartButton() {
  const items = useCart((s) => s.items);
  const openCart = useCartUi((s) => s.openCart);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const count = mounted ? cartCount(items) : 0;
  // Pulo quando o número SOBE (peça adicionada) — não ao abrir a página nem
  // ao tirar peça. A chave nova remonta o ícone e reinicia a animação.
  const anterior = useRef<number | null>(null);
  const [pulo, setPulo] = useState(0);
  useEffect(() => {
    if (!mounted) return;
    if (anterior.current != null && count > anterior.current)
      setPulo((p) => p + 1);
    anterior.current = count;
  }, [count, mounted]);

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={count > 0 ? `Abrir sacola (${count} itens)` : "Abrir sacola"}
      className="relative -m-2 inline-flex items-center p-2 transition-opacity hover:opacity-60"
    >
      <span
        key={pulo}
        className={pulo ? "sacola-pula inline-flex" : "inline-flex"}
      >
        <IconBag />
      </span>
      {mounted && count > 0 && (
        <span className="absolute right-0 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.6rem] font-bold text-accent-foreground">
          {count}
        </span>
      )}
    </button>
  );
}
