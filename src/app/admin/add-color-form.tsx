"use client";

import { useActionState, useEffect, useState } from "react";
import { addProductColorAction, type ActionResult } from "./actions";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import type { ColorOption } from "@/lib/admin-products";

const field =
  "rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground";

export function AddColorForm({
  productId,
  availableColors,
}: {
  productId: string;
  availableColors: ColorOption[];
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    addProductColorAction,
    null,
  );
  const { showToast } = useToast();
  const [choice, setChoice] = useState<string>(
    availableColors[0]?.id ?? "__new__",
  );
  const isNew = choice === "__new__";

  useEffect(() => {
    if (state?.ok) showToast("Cor adicionada");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="productId" value={productId} />

      <label className="text-xs text-muted">
        Cor
        <select
          name="colorId"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className={`${field} mt-1 block w-48`}
        >
          {availableColors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="__new__">+ Nova cor…</option>
        </select>
      </label>

      {isNew && (
        <>
          <label className="text-xs text-muted">
            Nome da cor
            <input
              name="newColorName"
              placeholder="Ex.: Verde militar"
              className={`${field} mt-1 block w-44`}
            />
          </label>
          <label className="text-xs text-muted">
            Cor (swatch)
            <input
              type="color"
              name="newColorHex"
              defaultValue="#000000"
              className="mt-1 block h-9 w-14 cursor-pointer rounded-md border border-border bg-transparent"
            />
          </label>
        </>
      )}

      <SubmitButton
        pendingText="Adicionando…"
        className="h-9 rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
      >
        + Adicionar cor
      </SubmitButton>
      {state?.error && (
        <span className="text-xs text-red-600">{state.error}</span>
      )}
    </form>
  );
}
