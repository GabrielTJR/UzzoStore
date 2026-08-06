"use client";

import { useActionState, useEffect, useState } from "react";
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
            defaultValue={address?.cep ?? ""}
            className={`${field} mt-1`}
          />
        </label>
        <label className={label}>
          Número
          <input name="number" defaultValue={address?.number ?? ""} className={`${field} mt-1`} />
        </label>
      </div>

      <label className={label}>
        Rua *
        <input name="street" required defaultValue={address?.street ?? ""} className={`${field} mt-1`} />
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
          <input name="district" defaultValue={address?.district ?? ""} className={`${field} mt-1`} />
        </label>
        <label className={label}>
          Cidade *
          <input name="city" required defaultValue={address?.city ?? ""} className={`${field} mt-1`} />
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
            defaultValue={address?.state ?? ""}
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
