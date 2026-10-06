"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateOwnNameAction, changeOwnPasswordAction } from "../auth-actions";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "../actions";

const field =
  "h-10 w-full rounded-xs border border-border bg-transparent px-3 text-sm outline-none focus:border-foreground";
const label = "block text-sm font-medium";
const botao =
  "h-10 shrink-0 rounded-xs bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90";

export function NameForm({ currentName }: { currentName: string | null }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    updateOwnNameAction,
    null,
  );
  const { showToast } = useToast();
  useEffect(() => {
    if (state?.ok) showToast("Nome atualizado");
    else if (state?.error) showToast(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="flex max-w-md items-end gap-2">
      <label className={`${label} flex-1`}>
        <span className="sr-only">Seu nome</span>
        <input
          name="name"
          required
          defaultValue={currentName ?? ""}
          placeholder="Ex.: Gabriel"
          autoComplete="name"
          className={field}
        />
      </label>
      <SubmitButton pendingText="Salvando…" className={botao}>
        Salvar
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
  const [diferente, setDiferente] = useState(false);
  useEffect(() => {
    if (state?.ok) {
      showToast("Senha alterada");
      formRef.current?.reset();
    } else if (state?.error) showToast(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(e) => {
        const fd = new FormData(e.currentTarget);
        // Conferência só na tela: o servidor recebe uma senha, e é ela que
        // vale. Digitar duas vezes evita trancar a própria conta por um erro
        // de digitação num campo que não mostra o que se digita.
        if (fd.get("password") !== fd.get("confirm")) {
          e.preventDefault();
          setDiferente(true);
        }
      }}
      className="max-w-md space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Nova senha
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="mín. 8 caracteres"
            onChange={() => setDiferente(false)}
            className={`${field} mt-1.5 font-normal`}
          />
        </label>
        <label className={label}>
          Repita a senha
          <input
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            onChange={() => setDiferente(false)}
            aria-invalid={diferente}
            className={`${field} mt-1.5 font-normal ${diferente ? "border-red-600" : ""}`}
          />
        </label>
      </div>
      {diferente && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          As duas senhas não são iguais.
        </p>
      )}
      <SubmitButton pendingText="Alterando…" className={botao}>
        Alterar senha
      </SubmitButton>
    </form>
  );
}
