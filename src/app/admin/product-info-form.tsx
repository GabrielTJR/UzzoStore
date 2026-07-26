"use client";

import { useActionState } from "react";
import { updateProductAction, type ActionResult } from "./actions";
import { CATEGORIES } from "@/lib/categories";
import type { AdminProduct } from "@/lib/admin-products";

const field =
  "w-full rounded-md border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-foreground";
const label = "block text-sm font-medium";

export function ProductInfoForm({ product }: { product: AdminProduct }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateProductAction,
    null,
  );

  const categoryNames: string[] = CATEGORIES.map((c) => c.name);
  const extraCategory =
    product.categoryName && !categoryNames.includes(product.categoryName)
      ? [product.categoryName]
      : [];

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="productId" value={product.id} />

      <div className="space-y-1.5">
        <label className={label} htmlFor="name">
          Nome *
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={product.name}
          className={field}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={label} htmlFor="category">
            Categoria
          </label>
          <select
            id="category"
            name="category"
            defaultValue={product.categoryName ?? ""}
            className={field}
          >
            <option value="">Sem categoria</option>
            {[...categoryNames, ...extraCategory].map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={label} htmlFor="reference">
            Referência / SKU
          </label>
          <input
            id="reference"
            name="reference"
            defaultValue={product.reference ?? ""}
            className={field}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={label} htmlFor="description">
          Descrição
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={product.description ?? ""}
          className={field}
        />
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={product.active}
            className="h-4 w-4"
          />
          Ativo na loja
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={product.featured}
            className="h-4 w-4"
          />
          Destaque na home
        </label>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-full bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Salvar informações"}
        </button>
        {state?.ok && <span className="text-sm text-green-600">Salvo ✓</span>}
        {state?.error && (
          <span className="text-sm text-red-600">{state.error}</span>
        )}
      </div>
    </form>
  );
}
