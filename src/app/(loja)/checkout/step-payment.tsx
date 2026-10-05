"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import type { CartItem } from "@/lib/cart-store";
import type { SaldoSacola } from "@/app/(loja)/sacola/actions";
import { checkCouponAction } from "@/app/(loja)/sacola/shipping-actions";
import { formatBRL } from "@/lib/format";
import { installmentsFor } from "@/lib/installments";
import { displayProductName } from "@/lib/product-name";

/**
 * Passo 4: resumo, cupom e o botão de pagar. Tudo chega por props — os números
 * são EXIBIÇÃO (preço do localStorage, frete cotado); quem cobra é o servidor,
 * que relê preço, recota o frete e revalida o cupom ao criar o pedido.
 *
 * Três formulários irmãos, não um só: o Enter no campo do cupom não pode
 * disparar o pagamento.
 */

export type PayErroKind = "stock" | "coupon" | "other";

/** Mesmas frases da sacola, para o cliente não ler duas versões do mesmo aviso. */
function avisoFalta(saldo: SaldoSacola | undefined, qty: number): string | null {
  // Variante fora do saldo = peça que entrou depois da última leitura: ainda
  // não sabemos, e dizer "esgotado" até a leitura chegar seria mentira.
  if (!saldo) return null;
  const disp = saldo.qty;
  if (disp >= qty) return null;
  if (disp === 0)
    return saldo.reservado
      ? "Em processo de compra por outro cliente — remova para seguir"
      : "Esgotado — remova para seguir";
  return disp === 1
    ? "Só resta 1 — ajuste a quantidade"
    : `Só restam ${disp} — ajuste a quantidade`;
}

export function StepPayment({
  items,
  saldo,
  subtotal,
  coupon,
  couponDiscount,
  couponMsg,
  onCouponApplied,
  onCouponRemoved,
  freteRotulo,
  freteValor,
  total,
  temFalta,
  canPay,
  busy,
  saindo,
  onPay,
  error,
  errorKind,
  onAjustarSacola,
  whatsappHref,
}: {
  items: CartItem[];
  saldo: Record<string, SaldoSacola> | null;
  subtotal: number;
  coupon: string | null;
  couponDiscount: number;
  couponMsg: string | null;
  onCouponApplied: (code: string, discount: number) => void;
  onCouponRemoved: () => void;
  freteRotulo: string;
  /** `null` = a combinar (cotação desligada). */
  freteValor: number | null;
  total: number;
  temFalta: boolean;
  canPay: boolean;
  busy: boolean;
  saindo: boolean;
  onPay: () => void;
  error: string | null;
  errorKind: PayErroKind | null;
  onAjustarSacola: () => void;
  whatsappHref: string;
}) {
  const uid = useId();
  const [cupomAberto, setCupomAberto] = useState(false);
  const [cupomInput, setCupomInput] = useState("");
  const [cupomErro, setCupomErro] = useState<string | null>(null);
  const [cupomBusy, setCupomBusy] = useState(false);

  async function aplicarCupom(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = cupomInput.trim();
    if (!code || cupomBusy) return;
    setCupomErro(null);
    setCupomBusy(true);
    try {
      const res = await checkCouponAction(
        code,
        items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
      );
      if (res.ok) {
        onCouponApplied(res.code, res.discount);
        setCupomInput("");
        setCupomAberto(false);
      } else setCupomErro(res.error);
    } catch {
      setCupomErro("Não conseguimos conferir o cupom agora.");
    } finally {
      setCupomBusy(false);
    }
  }

  const parcelas = installmentsFor(total);
  const erroCupomId = `${uid}-cupom-erro`;

  return (
    <div className="space-y-5">
      <ul className="divide-y divide-border">
        {items.map((i) => {
          const falta = saldo ? avisoFalta(saldo[i.variantId], i.qty) : null;
          return (
            <li key={i.variantId} className="flex gap-3 py-3 first:pt-0">
              <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xs bg-surface">
                {i.image && (
                  <Image
                    src={i.image}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium leading-snug">
                    {displayProductName(i.productName)}
                  </p>
                  <p className="shrink-0 font-medium tabular-nums">
                    {formatBRL(i.price * i.qty)}
                  </p>
                </div>
                <p className="mt-0.5 text-muted">
                  {[i.color, i.size ? `tam. ${i.size}` : null, i.qty > 1 ? `${i.qty} unidades` : null]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {falta && (
                  <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                    {falta}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Cupom: recolhido, porque campo de cupom à vista manda o cliente
          procurar cupom fora da loja — e às vezes ele não volta. */}
      {coupon ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border px-4 py-3 text-sm">
          <span>
            Cupom <strong className="font-medium">{coupon}</strong>
            {couponDiscount > 0 && (
              <span className="text-muted">, −{formatBRL(couponDiscount)}</span>
            )}
          </span>
          <button
            type="button"
            onClick={onCouponRemoved}
            className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-muted"
          >
            remover<span className="sr-only"> cupom</span>
          </button>
        </div>
      ) : cupomAberto ? (
        <form onSubmit={aplicarCupom} noValidate className="space-y-1.5">
          <label htmlFor={`${uid}-cupom`} className="block text-sm font-medium">
            Cupom de desconto
          </label>
          <div className="flex gap-2">
            <input
              id={`${uid}-cupom`}
              name="coupon"
              autoComplete="off"
              autoCapitalize="characters"
              enterKeyHint="go"
              value={cupomInput}
              onChange={(e) => {
                setCupomInput(e.target.value.toUpperCase());
                setCupomErro(null);
              }}
              aria-invalid={!!cupomErro || undefined}
              aria-describedby={cupomErro ? erroCupomId : undefined}
              className="h-12 min-w-0 flex-1 rounded-xs border border-border bg-transparent px-4 text-base uppercase outline-none focus:border-foreground sm:text-sm"
            />
            <button
              type="submit"
              disabled={cupomBusy || !cupomInput.trim()}
              className="inline-flex h-12 items-center justify-center rounded-xs border border-foreground px-5 text-sm font-medium hover:bg-foreground hover:text-background disabled:opacity-50"
            >
              {cupomBusy ? "Conferindo…" : "Aplicar"}
            </button>
          </div>
          {cupomErro && (
            <p id={erroCupomId} role="alert" className="text-sm text-red-600 dark:text-red-400">
              {cupomErro}
            </p>
          )}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCupomAberto(true)}
          className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-muted"
        >
          Tem cupom?
        </button>
      )}
      {couponMsg && (
        <p role="status" className="text-sm text-muted">
          {couponMsg}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onPay();
        }}
        className="space-y-4"
      >
        <dl className="space-y-1.5 border-t border-border pt-4 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums">{formatBRL(subtotal)}</dd>
          </div>
          {coupon && couponDiscount > 0 && (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">Cupom {coupon}</dt>
              <dd className="tabular-nums">−{formatBRL(couponDiscount)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">{freteRotulo}</dt>
            <dd className="tabular-nums">
              {freteValor == null
                ? "A combinar"
                : freteValor > 0
                  ? formatBRL(freteValor)
                  : "Grátis"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
            <dt className="text-base font-medium">Total</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {formatBRL(total)}
            </dd>
          </div>
          {parcelas && (
            <p className="text-right text-xs text-muted">
              em até {parcelas.count}x de {formatBRL(parcelas.value)}
              {parcelas.semJuros ? " sem juros" : ""}
            </p>
          )}
        </dl>

        {error && (
          <div
            role="alert"
            className="space-y-2 rounded-sm border border-red-600/40 bg-red-600/5 px-4 py-3 text-sm"
          >
            <p className="text-red-700 dark:text-red-400">{error}</p>
            {errorKind === "stock" && (
              <button
                type="button"
                onClick={onAjustarSacola}
                className="inline-flex h-11 items-center justify-center rounded-xs border border-foreground px-5 font-medium hover:bg-foreground hover:text-background"
              >
                Ajustar sacola
              </button>
            )}
            {errorKind === "coupon" && (
              <button
                type="button"
                onClick={onCouponRemoved}
                className="inline-flex h-11 items-center justify-center rounded-xs border border-foreground px-5 font-medium hover:bg-foreground hover:text-background"
              >
                Remover cupom
              </button>
            )}
            {errorKind === "other" && (
              <p>
                <Link
                  href={whatsappHref}
                  prefetch={false}
                  className="underline underline-offset-4"
                >
                  Fechar pelo WhatsApp
                </Link>
              </p>
            )}
          </div>
        )}

        {temFalta && !error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Ajuste as peças marcadas acima para seguir.{" "}
            <button
              type="button"
              onClick={onAjustarSacola}
              className="inline-flex min-h-11 items-center align-middle underline underline-offset-4"
            >
              Ajustar sacola
            </button>
          </p>
        )}

        <button
          type="submit"
          disabled={!canPay}
          aria-busy={busy || saindo || undefined}
          className="inline-flex h-13 w-full items-center justify-center rounded-xs bg-foreground px-8 text-base font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy || saindo ? "Abrindo pagamento…" : "Pagar com Pix ou cartão"}
        </button>

        <div className="space-y-1 text-center text-sm text-muted">
          <p>Você paga no ambiente seguro da InfinitePay.</p>
          <p>
            Prefere conversar?{" "}
            <Link
              href={whatsappHref}
              prefetch={false}
              className="underline underline-offset-4 hover:text-foreground"
            >
              Fechar pelo WhatsApp
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
