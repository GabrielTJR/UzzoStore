"use client";

import { useActionState, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import { CARGOS, CARGOS_ATRIBUIVEIS, type AdminRole } from "@/lib/admin-roles";
import { resetTempPasswordAction, setAdminRoleAction } from "./actions";
import type { ActionResult } from "../actions";

/**
 * Cargo de uma pessoa, trocado no próprio select (o formulário se envia ao
 * mudar). O servidor recusa dono, a si mesmo e cargo fora da lista — o select
 * só aparece para o dono, mas isso é conveniência.
 */
export function RoleSelect({
  userId,
  role,
}: {
  userId: string;
  role: AdminRole;
}) {
  // `n` conta as respostas: se o servidor recusar, a key muda e o select
  // volta ao cargo gravado (ele é não controlado).
  const [state, action, pending] = useActionState<
    (ActionResult & { n: number }) | null,
    FormData
  >(
    async (prev, fd) => ({
      ...(await setAdminRoleAction(null, fd)),
      n: (prev?.n ?? 0) + 1,
    }),
    null,
  );
  const { showToast } = useToast();
  useEffect(() => {
    if (state?.ok) showToast("Cargo atualizado");
    else if (state?.error) showToast(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        key={`${role}-${state?.n ?? 0}`}
        defaultValue={role}
        disabled={pending}
        aria-label="Cargo"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-9 w-full rounded-xs border border-border bg-background pl-2.5 pr-7 text-sm font-medium outline-none focus:border-foreground disabled:opacity-60"
      >
        {CARGOS_ATRIBUIVEIS.map((r) => (
          <option key={r} value={r}>
            {CARGOS[r].nome}
          </option>
        ))}
      </select>
    </form>
  );
}

/**
 * "Nova senha provisória": abre um campo na própria linha. A pessoa entra com
 * ela e define outra no primeiro acesso — é o "reenviar convite" do painel,
 * que não manda e-mail (a senha vai por onde o dono quiser: WhatsApp, em mãos).
 */
export function TempPasswordForm({
  userId,
  nome,
}: {
  userId: string;
  nome: string;
}) {
  const [open, setOpen] = useState(false);
  // Fecha dentro da própria action (é transição): fechar num efeito faria um
  // render em cascata.
  const [state, action] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      const r = await resetTempPasswordAction(prev, fd);
      if (r.ok) setOpen(false);
      return r;
    },
    null,
  );
  const { showToast } = useToast();
  useEffect(() => {
    if (state?.ok) showToast("Senha provisória definida");
    else if (state?.error) showToast(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm underline-offset-4 hover:underline"
      >
        Nova senha
      </button>
    );

  return (
    <form
      action={action}
      className="fixed inset-x-4 bottom-4 z-30 space-y-3 rounded-sm border border-border bg-background p-4 shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-[calc(100%-0.75rem)] sm:w-80"
    >
      <input type="hidden" name="userId" value={userId} />
      <p className="text-sm">
        Nova senha provisória para <strong>{nome}</strong>. Mande para a pessoa;
        no próximo acesso ela define a própria.
      </p>
      <input
        name="tempPassword"
        type="text"
        required
        minLength={8}
        autoFocus
        autoComplete="off"
        placeholder="mín. 8 caracteres"
        aria-label="Senha provisória"
        className="h-10 w-full rounded-xs border border-border bg-transparent px-3 text-sm outline-none focus:border-foreground"
      />
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-9 px-2 text-sm text-muted hover:text-foreground"
        >
          Cancelar
        </button>
        <SubmitButton
          pendingText="Salvando…"
          className="h-9 rounded-xs bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90"
        >
          Definir senha
        </SubmitButton>
      </div>
    </form>
  );
}
