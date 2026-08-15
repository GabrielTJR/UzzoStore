"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createColorAction,
  updateColorAction,
  deleteColorAction,
  type ActionResult,
} from "./actions";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import type { ColorOption } from "@/lib/admin-products";

const field =
  "rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground";

export function NewColorForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    createColorAction,
    null,
  );
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      showToast("Cor cadastrada");
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-wrap items-end gap-3"
    >
      <label className="text-xs text-muted">
        Nome da cor
        <input
          name="name"
          required
          placeholder="Ex.: Azul marinho"
          className={`${field} mt-1 block w-52`}
        />
      </label>
      <label className="text-xs text-muted">
        Cor (swatch)
        <input
          type="color"
          name="hex"
          defaultValue="#000000"
          className="mt-1 block h-9 w-14 cursor-pointer rounded-md border border-border bg-transparent"
        />
      </label>
      <SubmitButton
        pendingText="Salvando…"
        className="h-9 rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
      >
        + Cadastrar cor
      </SubmitButton>
      {state?.error && (
        <span className="text-xs text-red-600">{state.error}</span>
      )}
    </form>
  );
}

export function ColorRow({
  color,
  usage,
}: {
  color: ColorOption;
  usage: number;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    updateColorAction,
    null,
  );
  const { showToast } = useToast();

  useEffect(() => {
    if (state?.ok) showToast("Cor atualizada");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3">
      <form action={action} className="flex flex-1 flex-wrap items-end gap-3">
        <input type="hidden" name="colorId" value={color.id} />
        <label className="text-xs text-muted">
          Nome
          <input
            name="name"
            required
            defaultValue={color.name}
            className={`${field} mt-1 block w-48`}
          />
        </label>
        <label className="text-xs text-muted">
          Swatch
          <input
            type="color"
            name="hex"
            defaultValue={color.hex ?? "#000000"}
            className="mt-1 block h-9 w-14 cursor-pointer rounded-md border border-border bg-transparent"
          />
        </label>
        <SubmitButton
          pendingText="Salvando…"
          className="h-9 rounded-full border border-border px-4 text-sm font-medium hover:border-foreground"
        >
          Salvar
        </SubmitButton>
        {state?.error && (
          <span className="text-xs text-red-600">{state.error}</span>
        )}
      </form>

      <span className="text-xs text-muted">
        {usage > 0 ? `${usage} produto${usage === 1 ? "" : "s"}` : "não usada"}
      </span>

      {usage === 0 ? (
        <form
          action={deleteColorAction}
          onSubmit={(e) => {
            if (!window.confirm(`Excluir a cor "${color.name}"?`))
              e.preventDefault();
          }}
        >
          <input type="hidden" name="colorId" value={color.id} />
          <SubmitButton
            pendingText="Excluindo…"
            className="h-9 px-2 text-sm text-red-600 hover:underline dark:text-red-400"
          >
            Excluir
          </SubmitButton>
        </form>
      ) : (
        <span
          title="Cor em uso por produtos — não pode ser excluída"
          className="h-9 px-2 text-sm text-muted opacity-50"
        >
          Excluir
        </span>
      )}
    </div>
  );
}
