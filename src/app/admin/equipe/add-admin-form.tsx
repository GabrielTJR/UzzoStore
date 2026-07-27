"use client";

import { useActionState, useEffect, useRef } from "react";
import { addAdminAction } from "./actions";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "../actions";

const field =
  "w-full rounded-md border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-foreground";
const label = "block text-sm font-medium";

export function AddAdminForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    addAdminAction,
    null,
  );
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      showToast("Admin adicionado");
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={label} htmlFor="name">
            Nome
          </label>
          <input id="name" name="name" className={field} />
        </div>
        <div className="space-y-1.5">
          <label className={label} htmlFor="email">
            E-mail *
          </label>
          <input id="email" name="email" type="email" required className={field} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className={label} htmlFor="tempPassword">
          Senha provisória *
        </label>
        <input
          id="tempPassword"
          name="tempPassword"
          type="text"
          required
          minLength={8}
          placeholder="mín. 8 caracteres"
          className={field}
        />
        <p className="text-xs text-muted">
          O admin usa esta senha no primeiro acesso e define a própria em
          seguida.
        </p>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton
        pendingText="Adicionando…"
        className="h-11 rounded-full bg-foreground px-8 text-sm font-medium text-background hover:opacity-90"
      >
        Adicionar admin
      </SubmitButton>
    </form>
  );
}
