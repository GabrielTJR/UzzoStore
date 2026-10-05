"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

/**
 * Avisa o Google Analytics da COMPRA, uma vez por pedido.
 *
 * Só é montado quando o servidor confirmou o pagamento e leu o pedido do
 * próprio cliente (ver `page.tsx`). A marca no localStorage impede contar duas
 * vezes quando o cliente recarrega a página ou volta a ela pelo histórico —
 * venda contada em dobro distorce o funil inteiro.
 */
export function TrackPurchase({
  number,
  total,
  shipping,
  coupon,
  items,
}: {
  number: number;
  total: number;
  shipping: number;
  coupon: string | null;
  items: { name: string; variant: string | null; price: number; qty: number }[];
}) {
  useEffect(() => {
    const chave = `uzzo-ga-compra-${number}`;
    try {
      if (localStorage.getItem(chave)) return;
    } catch {
      // sem localStorage: segue e envia (melhor uma vez a mais que nenhuma)
    }
    track("purchase", {
      transaction_id: String(number),
      value: total,
      shipping,
      coupon: coupon ?? undefined,
      items: items.map((i) => ({
        item_id: i.name,
        item_name: i.name,
        item_variant: i.variant ?? undefined,
        price: i.price,
        quantity: i.qty,
      })),
    });
    try {
      localStorage.setItem(chave, "1");
    } catch {
      // ignora
    }
  }, [number, total, shipping, coupon, items]);
  return null;
}
