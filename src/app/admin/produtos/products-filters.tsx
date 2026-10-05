"use client";

import Form from "next/form";
import Link from "next/link";
import {
  DEPARTMENT_COLUMN_READY,
  DEPARTMENT_VALUES,
  DEPARTMENT_VALUE_LABELS,
} from "@/lib/departments";
import type { ProductsSearch } from "./products-view";

const campo =
  "h-9 rounded-xs border border-border bg-background text-sm outline-none focus:border-foreground";
// Select compacto: a opção "vazia" leva o NOME do filtro ("Estoque"), então o
// controle se explica sozinho sem rótulo ao lado e cabe numa linha só no
// notebook. Filtro em uso fica com borda escura para saltar aos olhos.
const select = (ativo: boolean) =>
  `${campo} min-w-0 flex-1 basis-32 pl-2.5 pr-1 sm:w-32 sm:flex-none sm:basis-auto ${ativo ? "border-foreground font-medium" : "text-muted"}`;

/**
 * Busca + filtros da lista de produtos.
 *
 * Continua sendo um formulário GET (a URL é o estado: dá para favoritar
 * "estoque baixo", e os cards da Visão geral caem aqui já filtrados). O
 * `next/form` só acrescenta navegação sem recarregar a página; sem JS, ele
 * é um `<form>` comum. Trocar um select já filtra — o botão "Filtrar" só
 * existe para quem está sem JS (dentro do `<noscript>`); a busca vai no Enter.
 */
export function ProductsFilters({
  sp,
  categorias,
  filtrando,
}: {
  sp: ProductsSearch;
  categorias: string[];
  filtrando: boolean;
}) {
  return (
    <Form
      action="/admin/produtos"
      // Página dinâmica e sem loading.tsx: pré-carregar não adianta nada.
      prefetch={false}
      scroll={false}
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement)
          e.currentTarget.requestSubmit();
      }}
      className="mb-4 flex flex-wrap items-center gap-2"
    >
      <input
        type="search"
        name="q"
        defaultValue={sp.q ?? ""}
        placeholder="Nome ou referência"
        aria-label="Buscar produto"
        className={`${campo} w-full px-3 sm:w-auto sm:min-w-44 sm:max-w-xs sm:flex-1`}
      />
      {DEPARTMENT_COLUMN_READY && (
        <select
          name="departamento"
          defaultValue={sp.departamento ?? ""}
          aria-label="Departamento"
          className={select(!!sp.departamento)}
        >
          <option value="">Departamento</option>
          {DEPARTMENT_VALUES.map((d) => (
            <option key={d} value={d}>
              {DEPARTMENT_VALUE_LABELS[d]}
            </option>
          ))}
        </select>
      )}
      <select
        name="categoria"
        defaultValue={sp.categoria ?? ""}
        aria-label="Categoria"
        className={select(!!sp.categoria)}
      >
        <option value="">Categoria</option>
        {categorias.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select
        name="situacao"
        defaultValue={sp.situacao ?? ""}
        aria-label="Situação"
        className={select(!!sp.situacao)}
      >
        <option value="">Situação</option>
        <option value="ativo">Só ativos</option>
        <option value="inativo">Só inativos</option>
      </select>
      <select
        name="estoque"
        defaultValue={sp.estoque ?? ""}
        aria-label="Estoque"
        className={select(!!sp.estoque)}
      >
        <option value="">Estoque</option>
        <option value="baixo">Estoque baixo</option>
        <option value="zerado">Esgotados</option>
      </select>
      <select
        name="fotos"
        defaultValue={sp.fotos ?? ""}
        aria-label="Fotos"
        className={select(!!sp.fotos)}
      >
        <option value="">Fotos</option>
        <option value="sem">Sem foto</option>
      </select>
      <noscript>
        <button
          type="submit"
          className="h-9 rounded-xs border border-foreground px-4 text-sm font-semibold"
        >
          Filtrar
        </button>
      </noscript>
      {filtrando && (
        <Link
          href="/admin/produtos"
          prefetch={false}
          scroll={false}
          className="px-1.5 text-sm text-muted underline underline-offset-4 hover:text-foreground"
        >
          Limpar filtros
        </Link>
      )}
    </Form>
  );
}
