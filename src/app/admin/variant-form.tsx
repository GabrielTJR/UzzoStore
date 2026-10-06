"use client";

import { useActionState, useEffect, useId, useState } from "react";
import {
  saveVariantAction,
  deleteVariantAction,
  type ActionResult,
} from "./actions";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import type { AdminVariant } from "@/lib/admin-products";

const smallField =
  "h-8 w-12 rounded-xs border border-border bg-transparent px-2 text-sm outline-none focus:border-foreground";

/**
 * Uma linha da grade de uma cor: tamanho + estoque, em formato compacto para
 * várias caberem lado a lado. Os rótulos ficam pequenos acima dos campos (e
 * completos para leitor de tela); o "Salvar" só acende com mudança.
 */
export function VariantForm({
  productId,
  productColorId,
  variant,
}: {
  productId: string;
  productColorId: string;
  variant?: AdminVariant;
}) {
  const isNew = !variant;
  const initial = {
    size: variant?.size ?? "",
    qty: String(variant?.qty ?? 0),
  };

  const [size, setSize] = useState(initial.size);
  const [qty, setQty] = useState(initial.qty);
  const [baseline, setBaseline] = useState(initial);
  const uid = useId();

  const [state, action] = useActionState<ActionResult | null, FormData>(
    saveVariantAction,
    null,
  );
  const { showToast } = useToast();

  const dirty = size !== baseline.size || qty !== baseline.qty;
  // Zerado SALVO (não o que está sendo digitado): é o aviso de reposição.
  const zerado = !isNew && Number(baseline.qty) <= 0;
  const nomeTamanho = baseline.size || "Único";

  // Resposta nova da action: acerta os campos durante o render (padrão do
  // React para estado derivado); o efeito só dispara o toast, que é externo.
  const [visto, setVisto] = useState(state);
  if (state !== visto) {
    setVisto(state);
    if (state?.ok) {
      if (isNew) {
        setSize("");
        setQty("0");
        setBaseline({ size: "", qty: "0" });
      } else {
        setBaseline({ size, qty });
      }
    }
  }

  useEffect(() => {
    if (state?.ok) showToast(isNew ? "Tamanho adicionado" : "Alteração salva");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div
      className={`flex items-end gap-2 rounded-xs border px-2.5 py-2 ${
        isNew
          ? "border-dashed border-border"
          : zerado
            ? "border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30"
            : "border-border"
      }`}
    >
      <form action={action} className="flex min-w-0 flex-1 items-end gap-2">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="productColorId" value={productColorId} />
        {variant && <input type="hidden" name="variantId" value={variant.id} />}
        {/* O número que a tela mostrava: o servidor só grava se o banco ainda
            estiver nele (uma venda no meio-tempo não é apagada). */}
        {variant && (
          <input type="hidden" name="qtyOriginal" value={baseline.qty} />
        )}
        <div>
          <label
            htmlFor={`${uid}-s`}
            className="block text-[0.7rem] text-muted"
          >
            {isNew ? "Novo tamanho" : "Tamanho"}
          </label>
          <input
            id={`${uid}-s`}
            name="size"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder={isNew ? "GG" : "Único"}
            className={`${smallField} mt-0.5 font-semibold`}
          />
        </div>
        <div>
          <label
            htmlFor={`${uid}-q`}
            className="block text-[0.7rem] text-muted"
          >
            Estoque
            {zerado && <span className="sr-only"> (zerado)</span>}
          </label>
          <input
            id={`${uid}-q`}
            name="qty"
            type="number"
            min="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className={`${smallField} mt-0.5 tabular-nums ${zerado ? "font-semibold text-red-700 dark:text-red-400" : ""}`}
          />
        </div>
        <SubmitButton
          disabled={!dirty}
          pendingText="…"
          className={`h-8 rounded-xs px-2.5 text-xs font-semibold ${
            dirty
              ? "bg-foreground text-background hover:opacity-90"
              : "border border-border text-muted"
          }`}
        >
          {isNew ? "Adicionar" : "Salvar"}
        </SubmitButton>
        {state?.error && (
          <span role="alert" className="self-center text-xs text-red-600">
            {state.error}
          </span>
        )}
      </form>

      {variant && (
        <form
          action={deleteVariantAction}
          onSubmit={(e) => {
            if (!window.confirm(`Excluir o tamanho ${nomeTamanho}?`))
              e.preventDefault();
          }}
        >
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="variantId" value={variant.id} />
          <SubmitButton
            pendingText="…"
            className="flex h-8 w-8 items-center justify-center rounded-xs text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
          >
            <span className="sr-only">Excluir tamanho {nomeTamanho}</span>
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
