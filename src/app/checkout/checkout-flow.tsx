"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, cartSubtotal } from "@/lib/cart-store";
import { formatBRL } from "@/lib/format";
import { startOnlinePaymentAction } from "@/app/sacola/actions";
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

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = cartSubtotal(items);
  const canPay =
    profileComplete &&
    items.length > 0 &&
    (method === "pickup" || (method === "delivery" && !!addressId));

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

  if (!mounted)
    return <p className="mt-8 text-sm text-muted">Carregando…</p>;

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
              <span className="font-medium">Retirar na loja</span>
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
                O frete é combinado no WhatsApp depois da compra.
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
                      {a.complement ? ` — ${a.complement}` : ""} ·{" "}
                      {a.city}/{a.state} · CEP {a.cep}
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
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted">Total</span>
            <span className="text-xl font-medium">{formatBRL(subtotal)}</span>
          </div>

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
