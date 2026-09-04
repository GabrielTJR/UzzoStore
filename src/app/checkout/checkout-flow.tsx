"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, cartSubtotal } from "@/lib/cart-store";
import { formatBRL } from "@/lib/format";
import { ShippingOptions } from "@/components/shipping-options";
import { startOnlinePaymentAction } from "@/app/sacola/actions";
import {
  quoteShippingAction,
  checkCouponAction,
  type QuoteResult,
} from "@/app/sacola/shipping-actions";
import { ProfileForm } from "@/app/conta/account-forms";
import { AddressForm } from "@/app/conta/enderecos/address-forms";
import type { CustomerAddress, CustomerProfile } from "@/lib/customer";

const card = "rounded-lg border border-border p-5";
const stepTitle = "text-sm font-medium uppercase tracking-[0.15em] text-muted";

export function CheckoutFlow({
  profile,
  addresses,
}: {
  profile: CustomerProfile;
  addresses: CustomerAddress[];
}) {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const coupon = useCart((s) => s.coupon);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Dados obrigatórios para faturar e entregar.
  const profileComplete = !!(profile.fullName && profile.cpf && profile.phone);
  const [editingProfile, setEditingProfile] = useState(!profileComplete);

  const [method, setMethod] = useState<"pickup" | "delivery">(
    addresses.length > 0 ? "delivery" : "pickup",
  );
  const [addressId, setAddressId] = useState<string>(
    addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "",
  );
  const [addingAddress, setAddingAddress] = useState(false);

  // Frete: cotado pelo CEP do ENDEREÇO escolhido (não por CEP digitado solto).
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [freightServiceId, setFreightServiceId] = useState<number | null>(null);
  const [quoteTry, setQuoteTry] = useState(0);

  // Cupom aplicado na sacola: revalida aqui só para EXIBIR o desconto — quem
  // decide de verdade é o servidor na hora do pedido.
  const [couponDiscount, setCouponDiscount] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAddress = addresses.find((a) => a.id === addressId) ?? null;

  useEffect(() => {
    let ignore = false;
    setQuote(null);
    setFreightServiceId(null);
    if (method !== "delivery" || !selectedAddress?.cep || items.length === 0)
      return;
    setQuoting(true);
    quoteShippingAction(
      selectedAddress.cep,
      items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
    )
      .then((res) => {
        if (ignore) return;
        setQuote(res);
        // Pré-seleciona — um toque a menos no celular. Normalmente a mais
        // barata (marcar uma paga por padrão cobraria uma escolha que o
        // cliente não fez); com o frete grátis todas custam zero, e aí a mais
        // rápida é estritamente melhor para ele.
        if (res.ok && res.options.length > 0) {
          // Com frete grátis a loja cobre até a recomendada: entre as que saem
          // por R$ 0, a que chega antes é a melhor para o cliente e não custa
          // nada a mais para a loja. As pagas nunca vêm marcadas.
          const livres = res.freeApplied
            ? res.options.filter((o) => o.free)
            : [];
          const rec =
            livres.length > 0
              ? livres.reduce((a, b) => (b.days < a.days ? b : a))
              : res.options[0];
          setFreightServiceId(rec.serviceId);
        }
      })
      .catch(() => {
        if (!ignore) setQuote({ ok: false, error: "Não conseguimos cotar." });
      })
      .finally(() => {
        if (!ignore) setQuoting(false);
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, addressId, selectedAddress?.cep, items.length, quoteTry]);

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
      if (!ignore) setCouponDiscount(res.ok ? res.discount : 0);
    });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupon, items.length]);

  const subtotal = cartSubtotal(items);
  const freightOption =
    quote?.ok && freightServiceId != null
      ? (quote.options.find((o) => o.serviceId === freightServiceId) ?? null)
      : null;
  const freightCost = method === "delivery" ? (freightOption?.price ?? 0) : 0;
  const total = Math.max(0, subtotal - couponDiscount + freightCost);

  // Com a cotação funcionando, entrega exige uma opção de frete; se a cotação
  // está indisponível (sem token/fora do ar), o pedido segue e o frete é
  // combinado no WhatsApp — indisponibilidade não pode travar a venda.
  // Cotação FALHOU com o serviço configurado (não é o caso "sem token"): não
  // deixamos pagar às cegas — o cliente recota ou finaliza pelo WhatsApp.
  const quoteFailed = !!quote && !quote.ok && !quote.unavailable;
  const freightOk =
    method === "pickup" ||
    !quote ||
    (!quote.ok && quote.unavailable === true) ||
    (quote.ok && freightServiceId != null);
  const canPay =
    profileComplete &&
    items.length > 0 &&
    (method === "pickup" || (method === "delivery" && !!addressId)) &&
    !quoting &&
    !quoteFailed &&
    freightOk;

  async function handlePay() {
    if (!canPay || busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await startOnlinePaymentAction(
        items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
        method === "pickup"
          ? { method: "pickup" }
          : { method: "delivery", addressId },
        {
          couponCode: coupon,
          freightServiceId:
            method === "delivery" && quote?.ok ? freightServiceId : null,
          freightExpectedPrice:
            method === "delivery" && quote?.ok
              ? (freightOption?.price ?? null)
              : null,
        },
      );
      if (res.needsLogin) {
        router.push("/entrar?next=%2Fcheckout");
        return;
      }
      if (!res.ok || !res.url) {
        setError(res.error ?? "Não foi possível abrir o pagamento.");
        return;
      }
      window.location.href = res.url;
    } catch {
      setError("Não foi possível abrir o pagamento.");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return <p className="mt-8 text-sm text-muted">Carregando…</p>;

  if (items.length === 0)
    return (
      <div className="mt-8 rounded-lg border border-dashed border-border p-6 text-sm text-muted">
        <p>Sua sacola está vazia.</p>
        <Link
          href="/produtos"
          className="mt-2 inline-block underline underline-offset-4 hover:text-foreground"
        >
          Ver produtos
        </Link>
      </div>
    );

  return (
    <div className="mt-8 space-y-8">
      {/* 1. Dados do cliente */}
      <div>
        <p className={stepTitle}>1. Seus dados</p>
        <div className={`mt-3 ${card}`}>
          {editingProfile ? (
            <>
              {!profileComplete && (
                <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                  Para comprar precisamos do seu nome, CPF e telefone.
                </p>
              )}
              <ProfileForm profile={profile} />
              <button
                type="button"
                onClick={() => router.refresh()}
                className="mt-4 text-sm underline underline-offset-4 hover:text-foreground"
              >
                Já salvei, continuar
              </button>
            </>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
              <div>
                <p className="font-medium">{profile.fullName}</p>
                <p className="text-muted">
                  CPF {profile.cpf} · {profile.phone}
                </p>
                <p className="text-muted">{profile.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProfile(true)}
                className="text-sm underline underline-offset-4 hover:text-foreground"
              >
                Editar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Entrega ou retirada */}
      <div>
        <p className={stepTitle}>2. Entrega</p>
        <div className={`mt-3 space-y-4 ${card}`}>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="radio"
              name="method"
              checked={method === "pickup"}
              onChange={() => setMethod("pickup")}
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="font-medium">Retirar na loja — grátis</span>
              <span className="block text-muted">
                Rua 3650, nº 3573 — Sala 2, Balneário Camboriú/SC
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="radio"
              name="method"
              checked={method === "delivery"}
              onChange={() => setMethod("delivery")}
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="font-medium">Entrega</span>
              <span className="block text-muted">
                Calculamos o frete pelo seu endereço.
              </span>
            </span>
          </label>

          {method === "delivery" && (
            <div className="space-y-3 border-t border-border pt-4">
              {addresses.map((a) => (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-start gap-3 text-sm"
                >
                  <input
                    type="radio"
                    name="address"
                    checked={addressId === a.id}
                    onChange={() => setAddressId(a.id)}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="font-medium">
                      {a.label ?? "Endereço"}
                      {a.isDefault && (
                        <span className="ml-2 text-xs text-muted">
                          (principal)
                        </span>
                      )}
                    </span>
                    <span className="block text-muted">
                      {a.street}
                      {a.number ? `, ${a.number}` : ""}
                      {a.complement ? ` — ${a.complement}` : ""} · {a.city}/
                      {a.state} · CEP {a.cep}
                    </span>
                  </span>
                </label>
              ))}

              {addresses.length === 0 && !addingAddress && (
                <p className="text-sm text-muted">
                  Você ainda não tem endereço cadastrado.
                </p>
              )}

              {addingAddress ? (
                <div className="space-y-3">
                  <AddressForm
                    onDone={() => {
                      setAddingAddress(false);
                      router.refresh(); // traz o endereço novo para a lista
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setAddingAddress(false)}
                    className="text-sm text-muted underline underline-offset-4 hover:text-foreground"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingAddress(true)}
                  className="rounded-full border border-dashed border-border px-4 py-2 text-sm hover:border-foreground"
                >
                  + Cadastrar novo endereço
                </button>
              )}

              {/* Opções de frete do endereço escolhido */}
              {addressId && (
                <div className="border-t border-border pt-4">
                  <p className="text-sm font-medium">Frete</p>
                  {quoting && (
                    <p className="mt-2 text-sm text-muted">
                      Calculando opções…
                    </p>
                  )}
                  {quote && !quote.ok && (
                    <div className="mt-2 space-y-2 text-sm text-muted">
                      <p>
                        {quote.unavailable
                          ? "Cotação online em breve — combinamos o frete pelo WhatsApp depois do pagamento."
                          : (quote.error ?? "Não conseguimos cotar agora.")}
                      </p>
                      {!quote.unavailable && (
                        <button
                          type="button"
                          onClick={() => setQuoteTry((n) => n + 1)}
                          className="rounded-full border border-border px-4 py-1.5 text-xs font-medium hover:border-foreground"
                        >
                          Tentar cotar de novo
                        </button>
                      )}
                    </div>
                  )}
                  {quote?.ok && (
                    <ShippingOptions
                      options={quote.options}
                      selectedServiceId={freightServiceId}
                      onSelect={(o) => setFreightServiceId(o.serviceId)}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Resumo e pagamento */}
      <div>
        <p className={stepTitle}>3. Pagamento</p>
        <div className={`mt-3 ${card}`}>
          <ul className="space-y-1 text-sm text-muted">
            {items.map((i) => (
              <li key={i.variantId}>
                {i.qty}× {i.productName}
                {i.color || i.size
                  ? ` — ${[i.color, i.size].filter(Boolean).join(" / ")}`
                  : ""}{" "}
                · {formatBRL(i.price * i.qty)}
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
            <div className="flex items-baseline justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd>{formatBRL(subtotal)}</dd>
            </div>
            {couponDiscount > 0 && (
              <div className="flex items-baseline justify-between">
                <dt className="text-muted">Cupom {coupon}</dt>
                <dd>−{formatBRL(couponDiscount)}</dd>
              </div>
            )}
            {method === "delivery" && freightOption && (
              <div className="flex items-baseline justify-between">
                <dt className="text-muted">Frete ({freightOption.name})</dt>
                <dd>
                  {freightOption.price > 0
                    ? formatBRL(freightOption.price)
                    : "Grátis"}
                </dd>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-1">
              <dt className="text-muted">Total</dt>
              <dd className="text-xl font-medium">{formatBRL(total)}</dd>
            </div>
          </dl>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={handlePay}
            disabled={!canPay || busy}
            className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Abrindo pagamento…" : "Pagar com Pix ou cartão"}
          </button>

          {!profileComplete && (
            <p className="mt-2 text-center text-xs text-muted">
              Complete seus dados acima para continuar.
            </p>
          )}
          {method === "delivery" && !addressId && (
            <p className="mt-2 text-center text-xs text-muted">
              Escolha ou cadastre um endereço de entrega.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
