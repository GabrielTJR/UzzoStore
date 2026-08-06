"use client";

import { useActionState, useEffect } from "react";
import {
  updateProfileAction,
  changeCustomerPasswordAction,
  signOutCustomerAction,
  type ActionResult,
} from "./actions";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import type { CustomerProfile } from "@/lib/customer";

const field =
  "w-full rounded-md border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-foreground";
const label = "block text-sm font-medium";
const primary =
  "h-11 rounded-full bg-foreground px-8 text-sm font-medium text-background hover:opacity-90";

export function ProfileForm({ profile }: { profile: CustomerProfile }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    updateProfileAction,
    null,
  );
  const { showToast } = useToast();
  useEffect(() => {
    if (state?.ok) showToast("Dados salvos");
    else if (state?.error) showToast(state.error, "error");
  }, [state, showToast]);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1.5">
        <label className={label} htmlFor="fullName">
          Nome completo *
        </label>
        <input
          id="fullName"
          name="fullName"
          required
          defaultValue={profile.fullName ?? ""}
          className={field}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={label} htmlFor="phone">
            Telefone / WhatsApp
          </label>
          <input
            id="phone"
            name="phone"
            inputMode="tel"
            placeholder="(47) 99999-9999"
            defaultValue={profile.phone ?? ""}
            className={field}
          />
        </div>
        <div className="space-y-1.5">
          <label className={label} htmlFor="cpf">
            CPF
          </label>
          <input
            id="cpf"
            name="cpf"
            inputMode="numeric"
            defaultValue={profile.cpf ?? ""}
            className={field}
          />
        </div>
      </div>
      <p className="text-xs text-muted">
        E-mail da conta: {profile.email ?? "—"}
      </p>
      <SubmitButton pendingText="Salvando…" className={primary}>
        Salvar dados
      </SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    changeCustomerPasswordAction,
    null,
  );
  const { showToast } = useToast();
  useEffect(() => {
    if (state?.ok) showToast("Senha alterada");
    else if (state?.error) showToast(state.error, "error");
  }, [state, showToast]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <label className={label} htmlFor="password">
          Nova senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={`${field} w-64`}
        />
      </div>
      <SubmitButton
        pendingText="Salvando…"
        className="h-11 rounded-full border border-border px-6 text-sm font-medium hover:border-foreground"
      >
        Trocar senha
      </SubmitButton>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form action={signOutCustomerAction}>
      <SubmitButton
        pendingText="Saindo…"
        className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        Sair da conta
      </SubmitButton>
    </form>
  );
}
