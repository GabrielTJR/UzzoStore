"use client";

import {
  DEPARTMENT_COLUMN_READY,
  DEPARTMENT_VALUES,
  DEPARTMENT_VALUE_LABELS,
} from "@/lib/departments";
import { useActionState } from "react";
import { createProductAction, type ActionResult } from "./actions";
import type { StoreCategory } from "@/lib/categories";
import type { ColorOption } from "@/lib/admin-products";

const initialState: ActionResult | null = null;

const field =
  "h-10 w-full rounded-xs border border-border bg-transparent px-3 text-sm outline-none focus:border-foreground";
const label = "block text-sm font-medium";
const section = "space-y-5 rounded-sm border border-border bg-background p-5";
const sectionTitle = "font-display text-base font-bold";

/**
 * Cadastro de produto novo. Duas colunas quando a área de trabalho tem
 * ≥ 48rem (o container fica no page.tsx): o produto à esquerda, cores e
 * grade à direita — a mesma divisão da tela de edição, para onde o cadastro
 * leva em seguida.
 */
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
    <form
      action={formAction}
      className="grid items-start gap-6 @3xl:grid-cols-2"
    >
      <section className={section}>
        <h2 className={sectionTitle}>Informações</h2>

        <div className="space-y-1.5">
          <label className={label} htmlFor="name">
            Nome do produto *
          </label>
          <input id="name" name="name" required className={field} />
        </div>

        <div className="grid grid-cols-2 gap-3">
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
              Promocional (R$)
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={label} htmlFor="category">
              Categoria
            </label>
            <select
              id="category"
              name="category"
              defaultValue=""
              className={field}
            >
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
          {/* Só aparece depois da migração 0022 (ver lib/departments.ts). */}
          {DEPARTMENT_COLUMN_READY && (
            <div className="space-y-1.5">
              <label className={label} htmlFor="department">
                Departamento
              </label>
              <select
                id="department"
                name="department"
                defaultValue="masculino"
                className={field}
              >
                {DEPARTMENT_VALUES.map((d) => (
                  <option key={d} value={d}>
                    {DEPARTMENT_VALUE_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {DEPARTMENT_COLUMN_READY && (
            <p className="col-span-2 -mt-1 text-xs text-muted">
              Unissex aparece em Masculino e em Feminino.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className={label} htmlFor="reference">
            Referência / SKU
          </label>
          <input id="reference" name="reference" className={field} />
        </div>

        <div className="space-y-1.5">
          <label className={label} htmlFor="description">
            Descrição
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            className="w-full rounded-xs border border-border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-foreground"
          />
        </div>
      </section>

      <section className={section}>
        <h2 className={sectionTitle}>Cores e tamanhos</h2>

        <div className="space-y-2">
          <span className={label}>Cores *</span>
          <p className="text-xs text-muted">
            Escolha uma ou mais cores do cadastro geral. Cada cor terá suas
            fotos e seu estoque na tela de edição.
          </p>
          {colors.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {colors.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded-xs border border-border px-3 py-2 text-sm has-[:checked]:border-foreground has-[:checked]:font-medium"
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
            ajuste na edição, junto com as fotos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4">
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-xs bg-foreground px-6 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Cadastrar produto"}
          </button>
          {state?.error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}
        </div>
      </section>
    </form>
  );
}
