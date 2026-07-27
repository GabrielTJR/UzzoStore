"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  updateOwnNameAction,
  changeOwnPasswordAction,
} from "../auth-actions";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "../actions";

const field =
  "w-full rounded-md border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-foreground";
const label = "block text-sm font-medium";

export function NameForm({ currentName }: { currentName: string | null }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    updateOwnNameAction,
    null,
  );
  const { showToast } = useToast();
  useEffect(() => {
    if (state?.ok) showToast("Nome atualizado");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <label className={label} htmlFor="name">
          Seu nome
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={currentName ?? ""}
          className={field}
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton
        pendingText="Salvando…"
        className="h-11 rounded-full bg-foreground px-8 text-sm font-medium text-background hover:opacity-90"
      >
        Salvar nome
      </SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    changeOwnPasswordAction,
    null,
  );
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      showToast("Senha alterada");
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
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
          placeholder="mín. 8 caracteres"
          className={field}
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton
        pendingText="Alterando…"
        className="h-11 rounded-full bg-foreground px-8 text-sm font-medium text-background hover:opacity-90"
      >
        Alterar senha
      </SubmitButton>
    </form>
  );
}
