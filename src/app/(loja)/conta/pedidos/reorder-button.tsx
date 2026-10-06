"use client";

import { useState, useTransition } from "react";
import { useCart } from "@/lib/cart-store";
import { useCartUi } from "@/lib/cart-ui";
import { displayProductName } from "@/lib/product-name";
import { reorderAction } from "../actions";

/**
 * "Comprar de novo": põe na sacola as peças do pedido (preço e estoque de
 * hoje) e abre a gaveta. Peça que saiu da loja ou esgotou é avisada, não
 * some em silêncio.
 */
export function ReorderButton({
  orderId,
  className = "",
}: {
  orderId: string;
  className?: string;
}) {
  const addItem = useCart((s) => s.addItem);
  const [pendente, start] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <div className={className}>
      <button
        type="button"
        disabled={pendente}
        onClick={() =>
          start(async () => {
            setAviso(null);
            const r = await reorderAction(orderId);
            if (!r.ok) {
              setAviso(r.error ?? "Não deu para montar a sacola agora.");
              return;
            }
            for (const { qty, ...item } of r.itens) addItem(item, qty);
            if (r.fora.length)
              setAviso(
                `${r.itens.length ? "Algumas peças não estão" : "As peças não estão"} mais disponíveis: ${r.fora
                  .map(displayProductName)
                  .join(", ")}.`,
              );
            if (r.itens.length) useCartUi.getState().openCart();
          })
        }
        className="inline-flex h-11 items-center justify-center rounded-xs border border-foreground px-5 text-sm font-semibold hover:bg-foreground hover:text-background disabled:opacity-60"
      >
        {pendente ? "Montando a sacola…" : "Comprar de novo"}
      </button>
      {aviso && (
        <p role="status" className="mt-2 text-sm text-muted">
          {aviso}
        </p>
      )}
    </div>
  );
}
