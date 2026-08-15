"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  type ActionResult,
} from "./actions";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import type { AdminCategory } from "@/lib/admin-products";

const field =
  "rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground";

export function NewCategoryForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    createCategoryAction,
    null,
  );
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      showToast("Categoria criada");
      formRef.current?.reset();
    } else if (state?.error) {
      showToast(state.error, "error");
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
        Nome da categoria
        <input
          name="name"
          required
          placeholder="Ex.: Jaquetas"
          className={`${field} mt-1 block w-56`}
        />
      </label>
      <SubmitButton
        pendingText="Salvando…"
        className="h-9 rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
      >
        + Criar categoria
      </SubmitButton>
    </form>
  );
}

export function CategoryRow({ category }: { category: AdminCategory }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    updateCategoryAction,
    null,
  );
  const { showToast } = useToast();

  useEffect(() => {
    if (state?.ok) showToast("Categoria atualizada");
    else if (state?.error) showToast(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const count = category.products;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3">
      <form action={action} className="flex flex-1 flex-wrap items-end gap-3">
        <input type="hidden" name="categoryId" value={category.id} />
        <label className="text-xs text-muted">
          Nome
          <input
            name="name"
            required
            defaultValue={category.name}
            className={`${field} mt-1 block w-56`}
          />
        </label>
        <SubmitButton
          pendingText="Salvando…"
          className="h-9 rounded-full border border-border px-4 text-sm font-medium hover:border-foreground"
        >
          Salvar
        </SubmitButton>
      </form>

      <span className="text-xs text-muted">
        {count} {count === 1 ? "produto" : "produtos"}
      </span>

      <form
        action={deleteCategoryAction}
        onSubmit={(e) => {
          const msg =
            count > 0
              ? `Excluir a categoria "${category.name}"? Os ${count} produto(s) dela ficam sem categoria.`
              : `Excluir a categoria "${category.name}"?`;
          if (!window.confirm(msg)) e.preventDefault();
        }}
      >
        <input type="hidden" name="categoryId" value={category.id} />
        <SubmitButton
          pendingText="Excluindo…"
          className="h-9 px-2 text-sm text-red-600 hover:underline dark:text-red-400"
        >
          Excluir
        </SubmitButton>
      </form>
    </div>
  );
}
