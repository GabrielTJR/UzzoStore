"use client";

import {
  DEPARTMENT_COLUMN_READY,
  DEPARTMENT_VALUES,
  DEPARTMENT_VALUE_LABELS,
} from "@/lib/departments";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { updateProductAction, type ActionResult } from "./actions";
import type { StoreCategory } from "@/lib/categories";
import type { MeasurementModelOption } from "@/lib/measurements";
import { useToast } from "@/components/toast";
import type { AdminProduct } from "@/lib/admin-products";

const field =
  "h-10 w-full rounded-xs border border-border bg-transparent px-3 text-sm outline-none focus:border-foreground";
const label = "block text-sm font-medium";
const hint = "text-xs text-muted";

/** 119.9 → "119,90": o campo mostra o preço como se digita (o servidor aceita
 * vírgula, ver parsePrice), em vez do "119.9" cru do banco. */
const precoBR = (v: number) => v.toFixed(2).replace(".", ",");

/**
 * Informações do produto inteiro (nome, preço, categoria…). Os campos andam
 * em pares para caber na coluna estreita da tela de edição; a barra de salvar
 * gruda no pé da tela enquanto o formulário está à vista, para o botão não
 * ficar escondido embaixo da descrição.
 */
export function ProductInfoForm({
  product,
  categories,
  models,
  podeDestacar,
}: {
  product: AdminProduct;
  categories: StoreCategory[];
  models: MeasurementModelOption[];
  podeDestacar: boolean;
}) {
  const [state, action, pending] = useActionState<
    ActionResult | null,
    FormData
  >(updateProductAction, null);
  const { showToast } = useToast();
  const [dirty, setDirty] = useState(false);

  // Resposta nova da action: zera o "não salvo" durante o render (padrão do
  // React para estado derivado), e o efeito só cuida do toast, que é externo.
  const [visto, setVisto] = useState(state);
  if (state !== visto) {
    setVisto(state);
    if (state?.ok) setDirty(false);
  }

  useEffect(() => {
    if (state?.ok) showToast("Alteração salva");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const categoryNames: string[] = categories.map((c) => c.name);
  const extraCategory =
    product.categoryName && !categoryNames.includes(product.categoryName)
      ? [product.categoryName]
      : [];

  return (
    <form action={action} onChange={() => setDirty(true)} className="space-y-4">
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
            defaultValue={product.price != null ? precoBR(product.price) : ""}
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
            defaultValue={
              product.promoPrice != null ? precoBR(product.promoPrice) : ""
            }
            className={field}
          />
        </div>
        <p className={`${hint} col-span-2 -mt-1`}>
          Preço único: vale para todas as cores e tamanhos.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
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
        {/* Só aparece depois da migração 0022 (ver lib/departments.ts). */}
        {DEPARTMENT_COLUMN_READY && (
          <div className="space-y-1.5">
            <label className={label} htmlFor="department">
              Departamento
            </label>
            <select
              id="department"
              name="department"
              defaultValue={product.department}
              title="Em qual seção da loja a peça aparece. Unissex aparece nas duas."
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
          <p className={`${hint} col-span-2 -mt-1`}>
            Unissex aparece em Masculino e em Feminino.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
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
        <div className="space-y-1.5">
          <label className={label} htmlFor="weightGrams">
            Peso embalado (g)
          </label>
          <input
            id="weightGrams"
            name="weightGrams"
            inputMode="numeric"
            placeholder="padrão"
            defaultValue={
              product.weightGrams != null ? String(product.weightGrams) : ""
            }
            className={field}
          />
        </div>
        {/* O aviso do peso continua por inteiro: peso a menos vira cobrança
            da transportadora, e é o erro mais caro desta tela. */}
        <p className={`${hint} col-span-2 -mt-1`}>
          O peso entra na cotação do frete. Vazio usa o padrão da categoria.
          Pese COM a embalagem: peso a menos gera cobrança extra da
          transportadora.
        </p>
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
        <p className={hint}>
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

      <div className="space-y-1.5">
        <label className={label} htmlFor="description">
          Descrição
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={product.description ?? ""}
          className="w-full rounded-xs border border-border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-foreground"
        />
      </div>

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Na loja</legend>
        <label className="flex items-center gap-2.5 rounded-xs border border-border px-3 py-2.5 text-sm has-[:checked]:border-foreground">
          <input
            type="checkbox"
            name="active"
            defaultChecked={product.active}
            className="h-4 w-4"
          />
          Ativo na loja
        </label>
        {podeDestacar && (
          <label className="flex items-center gap-2.5 rounded-xs border border-border px-3 py-2.5 text-sm has-[:checked]:border-foreground">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={product.featured}
              className="h-4 w-4"
            />
            Destaque na home
          </label>
        )}
      </fieldset>

      {/* Barra de salvar: gruda no pé da tela enquanto o formulário está à
          vista. Os -mx/-mb casam com o p-5 do painel em volta. */}
      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-b-sm border-t border-border bg-background px-5 py-3">
        <button
          type="submit"
          disabled={pending || !dirty}
          className="h-10 rounded-xs bg-foreground px-6 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Salvando…" : "Salvar informações"}
        </button>
        {state?.error ? (
          <span className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </span>
        ) : (
          <span className="text-xs text-muted">
            {dirty ? "Alterações não salvas" : "Tudo salvo"}
          </span>
        )}
      </div>
    </form>
  );
}
