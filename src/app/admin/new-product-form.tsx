"use client";

import { useActionState } from "react";
import { createProductAction, type ActionResult } from "./actions";
import type { StoreCategory } from "@/lib/categories";
import type { ColorOption } from "@/lib/admin-products";

const initialState: ActionResult | null = null;

const field =
  "w-full rounded-md border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-foreground";
const label = "block text-sm font-medium";

export function NewProductForm({
  colors,
  categories,
}: {
  colors: ColorOption[];
  categories: StoreCategory[];
}) {
  const [state, formAction, pending] = useActionState(
    createProductAction,
    initialState,
  );

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
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
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
          <label className={label} htmlFor="promoPrice">
            Preço promocional (R$)
          </label>
          <input
            id="promoPrice"
            name="promoPrice"
            inputMode="decimal"
            placeholder="opcional"
            className={field}
          />
        </div>
      </div>

      {/* Cores */}
      <div className="space-y-2">
        <span className={label}>Cores *</span>
        <p className="text-xs text-muted">
          Escolha uma ou mais cores do cadastro geral. Cada cor terá suas fotos
          e seu estoque na tela de edição.
        </p>
        {colors.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1">
            {colors.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <input type="checkbox" name="colorIds" value={c.id} />
                <span
                  aria-hidden
                  className="inline-block h-4 w-4 rounded-full border border-border"
                  style={c.hex ? { backgroundColor: c.hex } : undefined}
                />
                {c.name}
              </label>
            ))}
          </div>
        )}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs text-muted" htmlFor="newColors">
            Ou crie novas cores (separadas por vírgula)
          </label>
          <input
            id="newColors"
            name="newColors"
            placeholder="Ex.: Azul marinho, Vinho"
            className={field}
          />
        </div>
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
        <p className="text-xs text-muted">
          A grade é criada para cada cor × tamanho. O estoque começa em 0 —
          ajuste na edição.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className={label} htmlFor="description">
          Descrição
        </label>
        <textarea id="description" name="description" rows={3} className={field} />
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
