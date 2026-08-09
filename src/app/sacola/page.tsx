"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart, cartSubtotal, type CartItem } from "@/lib/cart-store";
import { formatBRL } from "@/lib/format";
import { createOrderAction, startOnlinePaymentAction } from "./actions";
import { useRouter } from "next/navigation";

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
    return `• ${i.qty}x ${i.productName}${label} — ${formatBRL(i.price * i.qty)}`;
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

export default function SacolaPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const removeItem = useCart((s) => s.removeItem);

  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  /**
   * Registra o pedido e só então abre o WhatsApp. A janela é aberta ANTES do
   * await (e depois redirecionada): navegador bloqueia window.open disparado
   * fora do clique. Se o registro falhar, seguimos para o WhatsApp mesmo assim
   * — perder a venda por causa do histórico seria pior.
   */
  /** Pagamento online: exige login e leva ao checkout da InfinitePay. */
  async function handlePayOnline() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await startOnlinePaymentAction(
        items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
      );
      if (res.needsLogin) {
        router.push(`/entrar?next=${encodeURIComponent("/sacola")}`);
        return;
      }
      if (!res.ok || !res.url) {
        setError(res.error ?? "Não foi possível abrir o pagamento.");
        return;
      }
      window.location.href = res.url; // mesma aba: é um fluxo de pagamento
    } catch {
      setError("Não foi possível abrir o pagamento.");
    } finally {
      setBusy(false);
    }
  }

  async function handleWhatsapp() {
    if (busy) return;
    setError(null);
    setBusy(true);
    const win = window.open("about:blank", "_blank");
    try {
      const res = await createOrderAction(
        items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
        "whatsapp",
      );
      if (!res.ok && res.error) setError(res.error);
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        buildWhatsappMessage(items, subtotal, res.orderNumber),
      )}`;
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch {
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        buildWhatsappMessage(items, subtotal),
      )}`;
      if (win) win.location.href = url;
      else window.location.href = url;
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-16 text-sm text-muted">
        Carregando…
      </section>
    );
  }

  const subtotal = cartSubtotal(items);

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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={handlePayOnline}
            disabled={busy}
            className="inline-flex h-12 items-center justify-center rounded-full border border-border px-8 text-sm font-medium transition-colors hover:border-foreground disabled:opacity-60"
          >
            {busy ? "Abrindo pagamento…" : "Pagar com Pix ou cartão"}
          </button>
          <button
            type="button"
            onClick={handleWhatsapp}
            disabled={busy}
            className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Registrando pedido…" : "Finalizar no WhatsApp"}
          </button>
        </div>

        <p className="max-w-md text-right text-xs text-muted">
          Ao finalizar, registramos seu pedido e abrimos a conversa no WhatsApp
          com o número dele. Frete e forma de pagamento são combinados por lá.
        </p>
      </div>
    </section>
  );
}
