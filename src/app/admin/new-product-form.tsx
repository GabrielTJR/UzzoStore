"use client";

import { useActionState } from "react";
import { createProductAction, type CreateProductResult } from "./actions";
import { CATEGORIES } from "@/lib/categories";

const initialState: CreateProductResult | null = null;

export function NewProductForm() {
  const [state, formAction, pending] = useActionState(
    createProductAction,
    initialState,
  );

  const field =
    "w-full rounded-md border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-foreground";
  const label = "block text-sm font-medium";

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <label className={label} htmlFor="name">
          Nome do produto *
        </label>
        <input id="name" name="name" required className={field} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={label} htmlFor="category">
            Categoria
          </label>
          <select id="category" name="category" defaultValue="" className={field}>
            <option value="" disabled>
              Selecione…
            </option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={label} htmlFor="reference">
            Referência / SKU
          </label>
          <input id="reference" name="reference" className={field} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={label} htmlFor="price">
            Preço (R$) *
          </label>
          <input
            id="price"
            name="price"
            required
            inputMode="decimal"
            placeholder="129,90"
            className={field}
          />
        </div>
        <div className="space-y-1.5">
          <label className={label} htmlFor="sizes">
            Tamanhos *
          </label>
          <input
            id="sizes"
            name="sizes"
            required
            placeholder="P, M, G"
            className={field}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={label} htmlFor="description">
          Descrição
        </label>
        <textarea id="description" name="description" rows={3} className={field} />
      </div>

      <div className="space-y-1.5">
        <label className={label} htmlFor="image">
          Foto do produto
        </label>
        <input
          id="image"
          name="image"
          type="file"
          accept="image/*"
          className="block w-full text-sm text-muted file:mr-4 file:rounded-full file:border file:border-border file:bg-transparent file:px-4 file:py-2 file:text-sm file:text-foreground"
        />
        <p className="text-xs text-muted">
          Opcional agora — dá para adicionar/trocar a foto depois.
        </p>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-full bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Salvando…" : "Cadastrar produto"}
      </button>
    </form>
  );
}
