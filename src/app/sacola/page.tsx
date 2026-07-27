"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart, cartSubtotal, type CartItem } from "@/lib/cart-store";
import { formatBRL } from "@/lib/format";

const WHATSAPP_NUMBER = "5547991744865";

function buildWhatsappMessage(items: CartItem[], subtotal: number): string {
  const lines = items.map((i) => {
    const attrs = [
      i.color ? `Cor ${i.color}` : null,
      i.size ? `Tam. ${i.size}` : null,
    ].filter(Boolean);
    const label = attrs.length ? ` — ${attrs.join(" / ")}` : "";
    return `• ${i.qty}x ${i.productName}${label} — ${formatBRL(i.price * i.qty)}`;
  });
  return [
    "Olá! Gostaria de finalizar meu pedido na Uzzo Store:",
    "",
    ...lines,
    "",
    `Subtotal: ${formatBRL(subtotal)}`,
  ].join("\n");
}

export default function SacolaPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const removeItem = useCart((s) => s.removeItem);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-16 text-sm text-muted">
        Carregando…
      </section>
    );
  }

  const subtotal = cartSubtotal(items);
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    buildWhatsappMessage(items, subtotal),
  )}`;

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Sua sacola está vazia
        </h1>
        <p className="mt-3 text-sm text-muted">
          Explore as peças e adicione seus favoritos.
        </p>
        <Link
          href="/produtos"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Ver produtos
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 font-serif text-3xl font-semibold tracking-tight">
        Sua sacola
      </h1>

      <ul className="divide-y divide-border border-y border-border">
        {items.map((item) => (
          <li key={item.variantId} className="flex items-center gap-4 py-5">
            <div className="flex-1">
              <Link
                href={`/produtos/${item.productSlug}`}
                className="text-sm font-medium hover:underline"
              >
                {item.productName}
              </Link>
              {(item.color || item.size) && (
                <p className="text-xs text-muted">
                  {[
                    item.color ? `Cor: ${item.color}` : null,
                    item.size ? `Tam.: ${item.size}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              <p className="mt-1 text-sm text-muted">{formatBRL(item.price)}</p>
            </div>

            <div className="flex items-center rounded-md border border-border">
              <button
                type="button"
                aria-label="Diminuir"
                onClick={() => setQty(item.variantId, item.qty - 1)}
                className="flex h-9 w-9 items-center justify-center text-muted hover:text-foreground"
              >
                −
              </button>
              <span className="w-8 text-center text-sm">{item.qty}</span>
              <button
                type="button"
                aria-label="Aumentar"
                onClick={() => setQty(item.variantId, item.qty + 1)}
                className="flex h-9 w-9 items-center justify-center text-muted hover:text-foreground"
              >
                +
              </button>
            </div>

            <div className="w-24 text-right text-sm font-medium">
              {formatBRL(item.price * item.qty)}
            </div>

            <button
              type="button"
              aria-label="Remover"
              onClick={() => removeItem(item.variantId)}
              className="text-muted transition-colors hover:text-foreground"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-end gap-4">
        <div className="flex w-full items-center justify-between sm:w-auto sm:gap-12">
          <span className="text-sm text-muted">Subtotal</span>
          <span className="text-xl font-medium">{formatBRL(subtotal)}</span>
        </div>
        <p className="text-xs text-muted">
          Frete e formas de pagamento são combinados no WhatsApp. Em breve:
          checkout com Pix e cartão.
        </p>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 sm:w-auto"
        >
          Finalizar pedido no WhatsApp
        </a>
      </div>
    </section>
  );
}
