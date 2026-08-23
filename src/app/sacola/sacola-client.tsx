"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  useCart,
  cartSubtotal,
  type CartItem,
  type CartShipping,
} from "@/lib/cart-store";
import { formatBRL } from "@/lib/format";
import { FreeShippingBar } from "@/components/free-shipping-bar";
import { ShippingOptions } from "@/components/shipping-options";
import type { ShippingOption } from "@/lib/shipping";
import { createOrderAction, type CheckoutResult } from "./actions";
import {
  quoteShippingAction,
  checkCouponAction,
  type QuoteResult,
} from "./shipping-actions";

const WHATSAPP_NUMBER = "5547991744865";

/**
 * Opção de frete -> o que fica guardado na sacola. O `name` mantém serviço e
 * transportadora (não o rótulo de benefício): é ele que aparece no e-mail do
 * pedido e no WhatsApp, onde "Mais barato" não ajudaria ninguém a despachar.
 */
function escolhaDeFrete(cep: string, o: ShippingOption): CartShipping {
  return {
    cep: cep.replace(/\D/g, ""),
    serviceId: o.serviceId,
    name: `${o.name}${o.company ? ` (${o.company})` : ""}`,
    price: o.price,
  };
}

/** Mensagem do pedido — monta com os totais CONFIRMADOS pelo servidor. */
function buildWhatsappMessage(
  items: CartItem[],
  totals: NonNullable<CheckoutResult["totals"]>,
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

  const resumo = [`Subtotal: ${formatBRL(totals.subtotal)}`];
  if (totals.discount > 0) resumo.push(`Cupom: −${formatBRL(totals.discount)}`);
  if (totals.shippingName)
    resumo.push(
      `Frete (${totals.shippingName}): ${
        totals.shippingCost > 0 ? formatBRL(totals.shippingCost) : "grátis"
      }`,
    );
  resumo.push(`Total: ${formatBRL(totals.total)}`);

  return [
    orderNumber
      ? `Olá! Gostaria de finalizar meu pedido nº ${orderNumber} na Uzzo Store:`
      : "Olá! Gostaria de finalizar meu pedido na Uzzo Store:",
    "",
    ...lines,
    "",
    ...resumo,
  ].join("\n");
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 rounded-md bg-black px-4 py-3 text-sm text-white shadow-lg animate-fade-in">
      {message}
    </div>
  );
}

function SkeletonItem() {
  return (
    <li className="flex items-center gap-4 py-5 animate-pulse">
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 rounded bg-border/60" />
        <div className="h-3 w-24 rounded bg-border/60" />
      </div>
      <div className="h-9 w-20 rounded bg-border/60" />
      <div className="h-4 w-16 rounded bg-border/60" />
    </li>
  );
}

export function SacolaClient({
  shippingEnabled,
}: {
  shippingEnabled: boolean;
}) {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const removeItem = useCart((s) => s.removeItem);
  const clearCart = useCart((s) => s.clear);
  const coupon = useCart((s) => s.coupon);
  const setCoupon = useCart((s) => s.setCoupon);
  const shipping = useCart((s) => s.shipping);
  const setShipping = useCart((s) => s.setShipping);

  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Frete
  const [cep, setCep] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<QuoteResult | null>(null);

  // Cupom
  const [couponInput, setCouponInput] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (shipping?.cep) setCep(shipping.cep);
  }, [shipping?.cep]);

  // O erro (ex.: "estoque insuficiente") DESABILITA os botões de compra.
  // Some assim que a sacola muda; se persistir, o servidor recusa de novo.
  useEffect(() => setError(null), [items, coupon, shipping]);

  // Sacola mudou => peso mudou => as opções cotadas não valem mais. O
  // cart-store já zera `shipping`; aqui derrubamos a lista para ninguém
  // clicar num preço órfão.
  const composicao = items.map((i) => `${i.variantId}:${i.qty}`).join("|");
  useEffect(() => {
    setQuote(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composicao]);

  // Cupom persistido (localStorage) é revalidado ao montar e a cada mudança
  // da sacola — sem isso o desconto exibido fica órfão e um cupom expirado
  // travaria a compra sem o cliente nem saber que há cupom aplicado.
  useEffect(() => {
    let ignore = false;
    if (!coupon || items.length === 0) {
      setCouponDiscount(0);
      return;
    }
    checkCouponAction(
      coupon,
      items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
    ).then((res) => {
      if (ignore) return;
      if (res.ok) {
        setCouponDiscount(res.discount);
        setCouponMsg(null);
      } else {
        setCoupon(null);
        setCouponDiscount(0);
        setCouponMsg(`O cupom aplicado não vale mais: ${res.error}`);
      }
    });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupon, composicao]);

  const subtotal = cartSubtotal(items);
  const freteExibido = shipping?.price ?? 0;
  const total = Math.max(0, subtotal - couponDiscount + freteExibido);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleQuote() {
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) {
      setQuote({ ok: false, error: "Digite um CEP válido." });
      return;
    }
    setQuoting(true);
    setQuote(null);
    try {
      const res = await quoteShippingAction(
        limpo,
        items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
      );
      setQuote(res);
      if (!res.ok) setShipping(null);
      // Já deixa a recomendada marcada. Sem isso o cliente tem que escolher
      // entre rádios vazios para seguir, no passo em que ele está mais perto de
      // desistir. `options[0]` é a mais barata (e é nela que o frete grátis
      // cai), então é também a escolha mais segura para o bolso dele.
      else if (res.options.length > 0) {
        setShipping(escolhaDeFrete(limpo, res.options[0]));
      }
    } catch {
      setQuote({ ok: false, error: "Não conseguimos cotar agora." });
    } finally {
      setQuoting(false);
    }
  }

  async function handleCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponMsg(null);
    const res = await checkCouponAction(
      code,
      items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
    );
    if (res.ok) {
      setCoupon(res.code);
      setCouponDiscount(res.discount);
      setCouponMsg(`Cupom ${res.code} aplicado: −${formatBRL(res.discount)}`);
    } else {
      setCoupon(null);
      setCouponDiscount(0);
      setCouponMsg(res.error);
    }
  }

  async function handleWhatsapp() {
    if (busy || !items.length) return;

    setBusy(true);
    setError(null);

    try {
      const res = await createOrderAction(
        items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
        "whatsapp",
        undefined,
        {
          couponCode: coupon,
          freight: shipping
            ? {
                cep: shipping.cep,
                serviceId: shipping.serviceId,
                expectedPrice: shipping.price,
              }
            : null,
        },
      );

      if (!res.ok || !res.totals) {
        setError(res.error || "Erro ao registrar pedido.");
        showToast("Erro ao finalizar pedido ❌");
        return;
      }

      showToast("Pedido criado com sucesso! Redirecionando... ✅");

      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        buildWhatsappMessage(items, res.totals, res.orderNumber),
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
        <ul className="divide-y divide-border border-y border-border">
          {[...Array(3)].map((_, i) => (
            <SkeletonItem key={i} />
          ))}
        </ul>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-xl font-medium">Sua sacola está vazia</h1>
        <p className="mt-2 text-sm text-muted">
          Explore as peças e adicione seus favoritos.
        </p>
        <Link
          href="/produtos"
          className="mt-6 inline-block text-sm font-medium underline"
        >
          Ver produtos
        </Link>
      </section>
    );
  }

  const inputCls =
    "h-11 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:border-foreground";
  const smallBtn =
    "inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-medium transition-colors hover:border-foreground disabled:opacity-50";

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
              className="flex h-10 w-10 shrink-0 items-center justify-center text-muted hover:text-foreground"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        {/* Frete + cupom */}
        <div className="space-y-6">
          {!shippingEnabled && (
            <p className="text-sm text-muted">
              🚚 O frete é combinado pelo WhatsApp depois do pedido.
            </p>
          )}
          {shippingEnabled && (
            <div>
              <p className="text-sm font-medium">Calcular frete e prazo</p>
              <div className="mt-2 flex gap-2">
                <input
                  inputMode="numeric"
                  placeholder="Seu CEP"
                  value={cep}
                  onChange={(e) =>
                    setCep(
                      e.target.value
                        .replace(/\D/g, "")
                        .replace(/^(\d{5})(\d)/, "$1-$2")
                        .slice(0, 9),
                    )
                  }
                  aria-label="CEP de entrega"
                  className={`${inputCls} w-36`}
                />
                <button
                  type="button"
                  onClick={handleQuote}
                  disabled={quoting}
                  className={smallBtn}
                >
                  {quoting ? "Calculando…" : "Calcular"}
                </button>
              </div>

              {quote && !quote.ok && (
                <p className="mt-2 text-sm text-muted">
                  {quote.unavailable
                    ? "Cotação online em breve — combinamos o frete pelo WhatsApp."
                    : quote.error}
                </p>
              )}

              {quote?.ok && (
                <ShippingOptions
                  options={quote.options}
                  selectedServiceId={shipping?.serviceId ?? null}
                  onSelect={(o) => setShipping(escolhaDeFrete(cep, o))}
                />
              )}
            </div>
          )}

          <div>
            <p className="text-sm font-medium">Cupom de desconto</p>
            <div className="mt-2 flex gap-2">
              <input
                placeholder="Código"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                aria-label="Cupom de desconto"
                className={`${inputCls} w-36 uppercase`}
              />
              <button type="button" onClick={handleCoupon} className={smallBtn}>
                Aplicar
              </button>
            </div>
            {couponMsg && (
              <p className="mt-2 text-sm text-muted">{couponMsg}</p>
            )}
            {coupon && couponDiscount > 0 && (
              <p className="mt-2 flex items-center gap-2 text-sm">
                <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-xs">
                  {coupon}
                </span>
                −{formatBRL(couponDiscount)}
                <button
                  type="button"
                  onClick={() => {
                    setCoupon(null);
                    setCouponDiscount(0);
                    setCouponMsg(null);
                  }}
                  className="text-xs text-muted underline underline-offset-4 hover:text-foreground"
                >
                  remover
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Totais */}
        <div className="space-y-4 md:justify-self-end md:text-right">
          {shippingEnabled && <FreeShippingBar subtotal={subtotal} />}

          <dl className="space-y-1.5 text-sm">
            <div className="flex items-baseline justify-between gap-10 md:justify-end">
              <dt className="text-muted">Subtotal</dt>
              <dd>{formatBRL(subtotal)}</dd>
            </div>
            {couponDiscount > 0 && (
              <div className="flex items-baseline justify-between gap-10 md:justify-end">
                <dt className="text-muted">Cupom {coupon}</dt>
                <dd>−{formatBRL(couponDiscount)}</dd>
              </div>
            )}
            {shipping && (
              <div className="flex items-baseline justify-between gap-10 md:justify-end">
                <dt className="text-muted">Frete ({shipping.name})</dt>
                <dd>
                  {shipping.price > 0 ? formatBRL(shipping.price) : "Grátis"}
                </dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-10 pt-1 md:justify-end">
              <dt className="text-sm text-muted">Total</dt>
              <dd className="text-xl font-medium">{formatBRL(total)}</dd>
            </div>
          </dl>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex w-full flex-col gap-3 md:items-end">
            {!error && !busy ? (
              <Link
                href="/checkout"
                className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border px-8 text-sm font-medium hover:border-foreground md:w-auto"
              >
                Pagar com Pix ou cartão
              </Link>
            ) : (
              <span className="inline-flex h-12 w-full cursor-not-allowed items-center justify-center rounded-full border border-border px-8 text-sm font-medium opacity-60 md:w-auto">
                Pagar com Pix ou cartão
              </span>
            )}

            <button
              type="button"
              onClick={handleWhatsapp}
              disabled={busy || !!error}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground px-8 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60 md:w-auto"
            >
              {busy ? "Registrando pedido…" : "Finalizar no WhatsApp"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
