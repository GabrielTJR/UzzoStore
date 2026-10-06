"use client";

import Link from "next/link";
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
import { categorySlug } from "@/lib/categories";

const field =
  "rounded-xs border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground";

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
    <form ref={formRef} action={action} className="space-y-3">
      <label className="block text-sm font-medium">
        Nome da categoria
        <input
          name="name"
          required
          placeholder="Ex.: Jaquetas"
          className={`${field} mt-1.5 block h-10 w-full font-normal`}
        />
      </label>
      <SubmitButton
        pendingText="Salvando…"
        className="h-10 w-full rounded-xs bg-foreground text-sm font-semibold text-background hover:opacity-90"
      >
        Criar categoria
      </SubmitButton>
    </form>
  );
}

/**
 * Uma categoria: nome editável, onde ela aparece na loja e quantas peças tem.
 * "Na loja" segue a mesma regra da vitrine: a categoria só tem endereço num
 * departamento quando há peça ATIVA dela lá (senão `/feminino/<categoria>` dá
 * 404), então o link só aparece nesse caso.
 */
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
  const slug = categorySlug(category.name);
  const lojas = (["masculino", "feminino"] as const).filter(
    (d) => category.ativos[d] > 0,
  );

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-2 p-4 md:grid-cols-[minmax(0,1fr)_13rem_8rem_auto] md:gap-x-6 lg:px-5">
      {/* Celular: nome + Salvar numa linha, e loja/produtos/excluir na de
          baixo (antes era uma linha para cada um). */}
      <form
        action={action}
        className="col-span-3 flex items-center gap-2 md:col-span-1"
      >
        <input type="hidden" name="categoryId" value={category.id} />
        <input
          name="name"
          required
          defaultValue={category.name}
          aria-label="Nome da categoria"
          className={`${field} h-9 w-full max-w-72 font-medium`}
        />
        <SubmitButton
          pendingText="Salvando…"
          className="h-9 shrink-0 rounded-xs border border-border px-3 text-sm font-medium hover:border-foreground"
        >
          Salvar
        </SubmitButton>
      </form>

      <div className="text-sm">
        {lojas.length > 0 ? (
          <span className="flex flex-wrap gap-x-3">
            {lojas.map((d) => (
              <Link
                key={d}
                href={`/${d}/${slug}`}
                target="_blank"
                prefetch={false}
                className="underline-offset-4 hover:underline"
              >
                {d === "masculino" ? "Masculino" : "Feminino"} (
                {category.ativos[d]})
              </Link>
            ))}
          </span>
        ) : (
          <span className="text-muted">Fora da loja (sem peça ativa)</span>
        )}
      </div>

      <div className="text-sm">
        {count > 0 ? (
          <Link
            href={`/admin/produtos?categoria=${encodeURIComponent(category.name)}`}
            prefetch={false}
            className="underline-offset-4 hover:underline"
          >
            {count} {count === 1 ? "produto" : "produtos"}
          </Link>
        ) : (
          <span className="text-muted">Nenhum produto</span>
        )}
      </div>

      <form
        action={deleteCategoryAction}
        onSubmit={(e) => {
          const msg =
            count > 0
              ? `Excluir a categoria "${category.name}"? Os ${count} produto(s) dela ficam sem categoria (não são apagados).`
              : `Excluir a categoria "${category.name}"?`;
          if (!window.confirm(msg)) e.preventDefault();
        }}
        className="md:text-right"
      >
        <input type="hidden" name="categoryId" value={category.id} />
        <SubmitButton
          pendingText="Excluindo…"
          className="text-sm text-red-600 underline-offset-4 hover:underline dark:text-red-400"
        >
          Excluir
        </SubmitButton>
      </form>
    </li>
  );
}
