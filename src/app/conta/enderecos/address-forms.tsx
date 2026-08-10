"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  saveAddressAction,
  deleteAddressAction,
  type ActionResult,
} from "../actions";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import type { CustomerAddress } from "@/lib/customer";

const field =
  "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground";
const label = "block text-xs text-muted";

export function AddressForm({
  address,
  onDone,
}: {
  address?: CustomerAddress;
  onDone?: () => void;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    saveAddressAction,
    null,
  );
  const { showToast } = useToast();

  // Preenchimento por CEP (ViaCEP — gratuito, sem cadastro). Controlado só o
  // que o CEP preenche; o resto segue não-controlado com defaultValue.
  const [cep, setCep] = useState(address?.cep ?? "");
  const [street, setStreet] = useState(address?.street ?? "");
  const [district, setDistrict] = useState(address?.district ?? "");
  const [city, setCity] = useState(address?.city ?? "");
  const [uf, setUf] = useState(address?.state ?? "");
  const [lookingUp, setLookingUp] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const numberRef = useRef<HTMLInputElement>(null);

  async function lookupCep(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepError(null);
    setLookingUp(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await res.json()) as {
        erro?: boolean | string;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro) {
        setCepError("CEP não encontrado.");
        return;
      }
      // CEP de rua única às vezes não traz logradouro — preenche o que veio.
      if (data.logradouro) setStreet(data.logradouro);
      if (data.bairro) setDistrict(data.bairro);
      if (data.localidade) setCity(data.localidade);
      if (data.uf) setUf(data.uf);
      numberRef.current?.focus(); // o número é o que sempre falta
    } catch {
      setCepError("Não foi possível consultar o CEP.");
    } finally {
      setLookingUp(false);
    }
  }
  useEffect(() => {
    if (state?.ok) {
      showToast("Endereço salvo");
      onDone?.();
    } else if (state?.error) showToast(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="space-y-4 rounded-lg border border-border p-5">
      {address && (
        <input type="hidden" name="addressId" value={address.id} />
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={label}>
          Apelido (casa, trabalho)
          <input name="label" defaultValue={address?.label ?? ""} className={`${field} mt-1`} />
        </label>
        <label className={label}>
          CEP *
          <input
            name="cep"
            required
            inputMode="numeric"
            placeholder="88330-000"
            value={cep}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 8);
              setCep(v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v);
              if (v.length === 8) void lookupCep(v); // 8 dígitos: já busca
            }}
            onBlur={(e) => void lookupCep(e.target.value)}
            className={`${field} mt-1`}
          />
          {lookingUp && (
            <span className="mt-1 block text-xs text-muted">buscando…</span>
          )}
          {cepError && (
            <span className="mt-1 block text-xs text-red-600">{cepError}</span>
          )}
        </label>
        <label className={label}>
          Número
          <input
            ref={numberRef}
            name="number"
            defaultValue={address?.number ?? ""}
            className={`${field} mt-1`}
          />
        </label>
      </div>

      <label className={label}>
        Rua *
        <input
          name="street"
          required
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          className={`${field} mt-1`}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className={label}>
          Complemento
          <input
            name="complement"
            defaultValue={address?.complement ?? ""}
            className={`${field} mt-1`}
          />
        </label>
        <label className={label}>
          Bairro
          <input
            name="district"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className={`${field} mt-1`}
          />
        </label>
        <label className={label}>
          Cidade *
          <input
            name="city"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={`${field} mt-1`}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className={label}>
          Estado (UF) *
          <input
            name="state"
            required
            maxLength={2}
            placeholder="SC"
            value={uf}
            onChange={(e) => setUf(e.target.value.toUpperCase())}
            className={`${field} mt-1 w-20 uppercase`}
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="isDefault"
            defaultChecked={address?.isDefault ?? false}
            className="h-4 w-4"
          />
          Endereço principal
        </label>
        <SubmitButton
          pendingText="Salvando…"
          className="ml-auto h-10 rounded-full bg-foreground px-6 text-sm font-medium text-background hover:opacity-90"
        >
          {address ? "Salvar endereço" : "Adicionar endereço"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function AddressCard({ address }: { address: CustomerAddress }) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return <AddressForm address={address} onDone={() => setEditing(false)} />;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border p-5">
      <div className="text-sm">
        <p className="font-medium">
          {address.label ?? "Endereço"}
          {address.isDefault && (
            <span className="ml-2 rounded-full border border-green-600 px-2 py-0.5 text-xs text-green-700 dark:text-green-400">
              principal
            </span>
          )}
        </p>
        <p className="mt-1 text-muted">
          {address.street}
          {address.number ? `, ${address.number}` : ""}
          {address.complement ? ` — ${address.complement}` : ""}
        </p>
        <p className="text-muted">
          {address.district ? `${address.district}, ` : ""}
          {address.city}/{address.state} · CEP {address.cep}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-sm underline underline-offset-4 hover:text-foreground"
        >
          Editar
        </button>
        <form
          action={deleteAddressAction}
          onSubmit={(e) => {
            if (!window.confirm("Excluir este endereço?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="addressId" value={address.id} />
          <SubmitButton
            pendingText="Excluindo…"
            className="text-sm text-red-600 underline-offset-4 hover:underline dark:text-red-400"
          >
            Excluir
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

export function NewAddressToggle() {
  const [open, setOpen] = useState(false);
  if (open) return <AddressForm onDone={() => setOpen(false)} />;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="rounded-full border border-dashed border-border px-5 py-2 text-sm hover:border-foreground"
    >
      + Adicionar endereço
    </button>
  );
}
