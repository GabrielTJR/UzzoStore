"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { updateProductAction, type ActionResult } from "./actions";
import type { StoreCategory } from "@/lib/categories";
import type { MeasurementModelOption } from "@/lib/measurements";
import { useToast } from "@/components/toast";
import type { AdminProduct } from "@/lib/admin-products";

const field =
  "w-full rounded-md border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-foreground";
const label = "block text-sm font-medium";

export function ProductInfoForm({
  product,
  categories,
  models,
}: {
  product: AdminProduct;
  categories: StoreCategory[];
  models: MeasurementModelOption[];
}) {
  const [state, action, pending] = useActionState<
    ActionResult | null,
    FormData
  >(updateProductAction, null);
  const { showToast } = useToast();
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      showToast("Alteração salva");
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const categoryNames: string[] = categories.map((c) => c.name);
  const extraCategory =
    product.categoryName && !categoryNames.includes(product.categoryName)
      ? [product.categoryName]
      : [];

  return (
    <form action={action} onChange={() => setDirty(true)} className="space-y-5">
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
            defaultValue={product.price != null ? String(product.price) : ""}
            className={field}
          />
          <p className="text-xs text-muted">
            Preço único do produto — vale para todas as cores e tamanhos.
          </p>
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
            defaultValue={
              product.promoPrice != null ? String(product.promoPrice) : ""
            }
            className={field}
          />
        </div>
        <div className="space-y-1.5">
          <label className={label} htmlFor="weightGrams">
            Peso embalado (g)
          </label>
          <input
            id="weightGrams"
            name="weightGrams"
            inputMode="numeric"
            placeholder="ex.: 450"
            defaultValue={
              product.weightGrams != null ? String(product.weightGrams) : ""
            }
            className={field}
          />
          <p className="text-xs text-muted">
            Usado na cotação do frete. Vazio = padrão da categoria. Pese COM a
            embalagem — peso a menos gera cobrança extra da transportadora.
          </p>
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

      <div className="space-y-1.5">
        <label className={label} htmlFor="measurementModelId">
          Tabela de medidas
        </label>
        <select
          id="measurementModelId"
          name="measurementModelId"
          defaultValue={product.measurementModelId ?? ""}
          className={field}
        >
          <option value="">Sem tabela</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">
          Os modelos são criados em{" "}
          <Link
            href="/admin/medidas"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Medidas
          </Link>
          .
        </p>
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
          disabled={pending || !dirty}
          className="h-11 rounded-full bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Salvar informações"}
        </button>
        {state?.error && (
          <span className="text-sm text-red-600">{state.error}</span>
        )}
      </div>
    </form>
  );
}
