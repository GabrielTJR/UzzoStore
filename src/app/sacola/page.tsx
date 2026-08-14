"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart, cartSubtotal, type CartItem } from "@/lib/cart-store";
import { formatBRL } from "@/lib/format";
import { createOrderAction } from "./actions";

const WHATSAPP_NUMBER = "5547991744865";

function buildWhatsappMessage(
  items: CartItem[],
  subtotal: number,
  orderNumber?: number,
): string {
  const lines = items.map((i) => {
    const attrs = [
      i.color ? `Cor ${i.color}` : null,
      i.size ? `Tam. ${i.size}` : null,
    ].filter(Boolean);

    const label = attrs.length ? ` — ${attrs.join(" / ")}` : "";

    return `• ${i.qty}x ${i.productName}${label} — ${formatBRL(
      i.price * i.qty,
    )}`;
  });

  return [
    orderNumber
      ? `Olá! Gostaria de finalizar meu pedido nº ${orderNumber} na Uzzo Store:`
      : "Olá! Gostaria de finalizar meu pedido na Uzzo Store:",
    "",
    ...lines,
    "",
    `Subtotal: ${formatBRL(subtotal)}`,
  ].join("\n");
}

/* ---------------- TOAST SIMPLES ---------------- */
function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 rounded-md bg-black px-4 py-3 text-sm text-white shadow-lg animate-fade-in">
      {message}{" "}
    </div>
  );
}

/* ---------------- SKELETON ---------------- */
function SkeletonItem() {
  return (
    <li className="flex items-center gap-4 py-5 animate-pulse">
      {" "}
      <div className="flex-1 space-y-2">
        {" "}
        <div className="h-4 w-40 bg-gray-200 rounded" />{" "}
        <div className="h-3 w-24 bg-gray-200 rounded" />{" "}
      </div>{" "}
      <div className="h-9 w-20 bg-gray-200 rounded" />{" "}
      <div className="h-4 w-16 bg-gray-200 rounded" />{" "}
    </li>
  );
}

export default function SacolaPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const removeItem = useCart((s) => s.removeItem);
  const clearCart = useCart((s) => s.clear);

  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const subtotal = cartSubtotal(items);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleWhatsapp() {
    if (busy || !items.length) return;

    setBusy(true);
    setError(null);

    try {
      const res = await createOrderAction(
        items.map((i) => ({
          variantId: i.variantId,
          qty: i.qty,
        })),
        "whatsapp",
      );

      if (!res.ok) {
        setError(res.error || "Erro ao registrar pedido.");
        showToast("Erro ao finalizar pedido ❌");
        return;
      }

      showToast("Pedido criado com sucesso! Redirecionando... ✅");

      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        buildWhatsappMessage(items, subtotal, res.orderNumber),
      )}`;

      // Esvaziar a sacola AQUI derrubaria a tela para "Sua sacola está vazia"
      // no mesmo render do toast — o cliente veria cara de erro justamente no
      // momento da conversão. Limpa só ao sair para o WhatsApp.
      setTimeout(() => {
        clearCart();
        window.location.href = url;
      }, 1200);
    } catch {
      setError("Erro inesperado. Tente novamente.");
      showToast("Erro inesperado ❌");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-10">
        {" "}
        <ul className="divide-y divide-border border-y border-border">
          {[...Array(3)].map((_, i) => (
            <SkeletonItem key={i} />
          ))}{" "}
        </ul>{" "}
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-10">
        {" "}
        <h1 className="text-xl font-medium">Sua sacola está vazia</h1>{" "}
        <p className="mt-2 text-sm text-muted">
          Explore as peças e adicione seus favoritos.{" "}
        </p>{" "}
        <Link
          href="/produtos"
          className="mt-6 inline-block text-sm font-medium underline"
        >
          Ver produtos{" "}
        </Link>{" "}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      {toast && <Toast message={toast} />}

      <h1 className="mb-6 text-xl font-medium">Sua sacola</h1>

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
                onClick={() => setQty(item.variantId, item.qty - 1)}
                aria-label={`Diminuir quantidade de ${item.productName}`}
                className="flex h-9 w-9 items-center justify-center"
              >
                −
              </button>

              <span className="w-8 text-center text-sm">{item.qty}</span>

              <button
                type="button"
                onClick={() => setQty(item.variantId, item.qty + 1)}
                aria-label={`Aumentar quantidade de ${item.productName}`}
                className="flex h-9 w-9 items-center justify-center"
              >
                +
              </button>
            </div>

            <div className="w-24 text-right text-sm font-medium">
              {formatBRL(item.price * item.qty)}
            </div>

            <button
              type="button"
              onClick={() => removeItem(item.variantId)}
              aria-label={`Remover ${item.productName} da sacola`}
              className="text-muted hover:text-foreground"
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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          {!error && !busy ? (
            <Link
              href="/checkout"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border px-8 text-sm font-medium hover:border-foreground"
            >
              Pagar com Pix ou cartão
            </Link>
          ) : (
            <span className="inline-flex h-12 items-center justify-center rounded-full border border-border px-8 text-sm font-medium opacity-60 cursor-not-allowed">
              Pagar com Pix ou cartão
            </span>
          )}

          <button
            type="button"
            onClick={handleWhatsapp}
            disabled={busy || !!error}
            className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Registrando pedido…" : "Finalizar no WhatsApp"}
          </button>
        </div>
      </div>
    </section>
  );
}
