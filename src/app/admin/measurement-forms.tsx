"use client";

import { useActionState, useEffect } from "react";
import {
  createMeasurementModelAction,
  deleteMeasurementModelAction,
  type ActionResult,
} from "./actions";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";

const field =
  "rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground";

export function NewMeasurementModelForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    createMeasurementModelAction,
    null,
  );
  const { showToast } = useToast();
  useEffect(() => {
    if (state?.error) showToast(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="text-xs text-muted">
        Nome do modelo
        <input
          name="name"
          required
          placeholder="Ex.: Bermuda Sarja"
          className={`${field} mt-1 block w-64`}
        />
      </label>
      <SubmitButton
        pendingText="Criando…"
        className="h-9 rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
      >
        + Criar modelo
      </SubmitButton>
    </form>
  );
}

export function DeleteMeasurementModelButton({
  modelId,
  name,
}: {
  modelId: string;
  name: string;
}) {
  return (
    <form
      action={deleteMeasurementModelAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Excluir o modelo "${name}"? Os produtos que usam ele ficam sem tabela de medidas.`,
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="modelId" value={modelId} />
      <SubmitButton
        pendingText="Excluindo…"
        className="text-xs text-red-600 underline-offset-4 hover:underline dark:text-red-400"
      >
        Excluir
      </SubmitButton>
    </form>
  );
}
