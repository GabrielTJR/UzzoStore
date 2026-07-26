"use client";

import { useActionState, useEffect, useState } from "react";
import {
  saveVariantAction,
  deleteVariantAction,
  type ActionResult,
} from "./actions";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import type { AdminVariant } from "@/lib/admin-products";

const smallField =
  "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground";

export function VariantForm({
  productId,
  variant,
}: {
  productId: string;
  variant?: AdminVariant;
}) {
  const isNew = !variant;
  const initial = {
    size: variant?.size ?? "",
    price: variant?.price != null ? String(variant.price) : "",
    qty: String(variant?.qty ?? 0),
  };

  const [size, setSize] = useState(initial.size);
  const [price, setPrice] = useState(initial.price);
  const [qty, setQty] = useState(initial.qty);
  const [baseline, setBaseline] = useState(initial);

  const [state, action] = useActionState<ActionResult | null, FormData>(
    saveVariantAction,
    null,
  );
  const { showToast } = useToast();

  const dirty =
    size !== baseline.size || price !== baseline.price || qty !== baseline.qty;

  useEffect(() => {
    if (!state?.ok) return;
    showToast(isNew ? "Tamanho adicionado" : "Alteração salva");
    if (isNew) {
      setSize("");
      setPrice("");
      setQty("0");
      setBaseline({ size: "", price: "", qty: "0" });
    } else {
      setBaseline({ size, price, qty });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div
      className={`flex flex-wrap items-end gap-3 rounded-md border p-3 ${
        isNew ? "border-dashed border-border" : "border-border"
      }`}
    >
      <form action={action} className="flex flex-1 flex-wrap items-end gap-3">
        <input type="hidden" name="productId" value={productId} />
        {variant && <input type="hidden" name="variantId" value={variant.id} />}
        <label className="text-xs text-muted">
          Tamanho
          <input
            name="size"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="Único"
            className={`${smallField} mt-1 w-24`}
          />
        </label>
        <label className="text-xs text-muted">
          Preço (R$)
          <input
            name="price"
            inputMode="decimal"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0,00"
            className={`${smallField} mt-1 w-28`}
          />
        </label>
        <label className="text-xs text-muted">
          Estoque
          <input
            name="qty"
            type="number"
            min="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className={`${smallField} mt-1 w-24`}
          />
        </label>
        <SubmitButton
          disabled={!dirty}
          pendingText={isNew ? "Adicionando…" : "Salvando…"}
          className="h-9 rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
        >
          {isNew ? "+ Adicionar tamanho" : "Salvar"}
        </SubmitButton>
        {state?.error && (
          <span className="text-xs text-red-600">{state.error}</span>
        )}
      </form>

      {variant && (
        <form
          action={deleteVariantAction}
          onSubmit={(e) => {
            if (!window.confirm("Excluir este tamanho?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="variantId" value={variant.id} />
          <SubmitButton
            pendingText="Excluindo…"
            className="h-9 px-2 text-sm text-red-600 hover:underline dark:text-red-400"
          >
            Excluir
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
