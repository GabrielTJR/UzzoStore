import Image from "next/image";
import Link from "next/link";
import { FeaturedStar } from "@/components/featured-star";
import { isLowStock, isSoldOut } from "@/lib/admin-overview";
import type { AdminProductListItem } from "@/lib/admin-products";
import {
  DEPARTMENT_COLUMN_READY,
  DEPARTMENT_VALUE_LABELS,
} from "@/lib/departments";
import { formatBRL } from "@/lib/format";
import { displayProductName } from "@/lib/product-name";
import { normalizeSearch } from "@/lib/products";
import { PageHeader, Panel, primaryButton } from "../admin-ui";
import { ProductsFilters } from "./products-filters";

export type ProductsSearch = {
  q?: string;
  departamento?: string;
  categoria?: string;
  situacao?: string;
  estoque?: string;
  fotos?: string;
};

/*
 * Quais colunas aparecem é decidido pela largura da TABELA (container query
 * no painel), não da janela: com o menu lateral aberto, uma tela de 1280px
 * deixa só ~960px para a lista, e é isso que importa.
 *
 * Ordem em que as colunas saem quando o espaço aperta (a primeira a sair é a
 * menos essencial):
 *   1. "N zerados" sob o estoque      → só com ≥ 56rem (notebook com menu).
 *   2. Categoria (+ departamento)     → só com ≥ 48rem; o filtro cobre.
 *   3. Fotos e destaque               → só com ≥ 42rem; "sem foto" desce
 *                                       para baixo do nome.
 *   4. Situação                       → só com ≥ 32rem; "Inativo" desce para
 *                                       baixo do nome.
 *   5. "Editar"                       → só com ≥ 28rem; o nome já é o link.
 * Nunca saem: foto + nome, preço e estoque — o que se olha a lista para saber.
 */
const th = "px-3 py-2.5 font-medium";
const td = "px-3 py-2.5";

/**
 * PRODUTOS — a lista de trabalho do catálogo, em largura inteira.
 *
 * Cada linha responde sem precisar abrir o produto: tem foto? quanto custa?
 * quanto tem em estoque? está na loja? A busca e os filtros são um formulário
 * GET (vivem na URL: dá para favoritar "estoque baixo" e os cards da Visão
 * geral caem aqui já filtrados).
 *
 * O filtro roda em memória sobre a lista completa — são dezenas de produtos.
 * Quando a carga do Microvix entrar (milhares), isto vira paginação no banco.
 */
export function ProductsView({
  todos,
  sp,
}: {
  todos: AdminProductListItem[];
  sp: ProductsSearch;
}) {
  const termo = normalizeSearch(sp.q ?? "");
  const categorias = [
    ...new Set(todos.map((p) => p.category).filter((c): c is string => !!c)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const products = todos.filter((p) => {
    if (
      termo &&
      !normalizeSearch(`${p.name} ${p.reference ?? ""}`).includes(termo)
    )
      return false;
    if (sp.departamento && p.department !== sp.departamento) return false;
    if (sp.categoria && p.category !== sp.categoria) return false;
    if (sp.situacao === "ativo" && !p.active) return false;
    if (sp.situacao === "inativo" && p.active) return false;
    if (sp.estoque === "baixo" && !isLowStock(p)) return false;
    if (sp.estoque === "zerado" && !isSoldOut(p)) return false;
    if (sp.fotos === "sem" && p.images > 0) return false;
    return true;
  });

  const filtrando = !!(
    termo ||
    sp.departamento ||
    sp.categoria ||
    sp.situacao ||
    sp.estoque ||
    sp.fotos
  );
  const inativos = todos.filter((p) => !p.active).length;

  return (
    <>
      <PageHeader
        title="Produtos"
        description={
          <>
            {todos.length} {todos.length === 1 ? "produto" : "produtos"}
            {inativos > 0 &&
              `, ${inativos} ${inativos === 1 ? "inativo" : "inativos"}`}
            {filtrando && `. Mostrando ${products.length}`}
          </>
        }
      >
        <Link href="/admin/produtos/novo" className={primaryButton}>
          Novo produto
        </Link>
      </PageHeader>

      {/* A `key` remonta o formulário quando a URL muda (ex.: "Limpar
          filtros"): os selects são não-controlados e manteriam o valor velho. */}
      <ProductsFilters
        key={JSON.stringify(sp)}
        sp={sp}
        categorias={categorias}
        filtrando={filtrando}
      />

      <div className="@container">
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted">
              <tr>
                <th className={th}>Produto</th>
                <th className={`${th} hidden @3xl:table-cell`}>Categoria</th>
                <th className={`${th} text-right`}>Preço</th>
                <th className={`${th} text-right`}>Estoque</th>
                <th className={`${th} hidden text-right @2xl:table-cell`}>
                  Fotos
                </th>
                <th className={`${th} hidden @lg:table-cell`}>Situação</th>
                <th className={`${th} hidden text-center @2xl:table-cell`}>
                  Destaque
                </th>
                <th className={`${th} hidden @md:table-cell`}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p) => (
                <ProductRow key={p.id} p={p} />
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted">
                    {filtrando
                      ? "Nenhum produto com esses filtros."
                      : "Nenhum produto ainda. Comece por “Novo produto”."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}

function ProductRow({ p }: { p: AdminProductListItem }) {
  const nome = displayProductName(p.name);
  const semFoto = p.images === 0;

  return (
    <tr className="hover:bg-surface/60">
      <td className={`${td} @2xl:min-w-56`}>
        <Link
          href={`/admin/produtos/${p.id}`}
          className="group flex items-center gap-3"
        >
          <span className="relative h-14 w-[2.35rem] shrink-0 overflow-hidden rounded-xs bg-surface">
            {p.thumb && (
              <Image
                src={p.thumb}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            )}
          </span>
          <span className="min-w-0">
            <span
              title={nome}
              className="line-clamp-2 font-semibold leading-snug group-hover:underline group-hover:underline-offset-4"
            >
              {nome}
            </span>
            {/* Linha de apoio: referência e, quando as colunas somem por
                falta de espaço, os avisos que viviam nelas. */}
            <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
              {p.reference && (
                <span className="hidden @2xl:inline">Ref. {p.reference}</span>
              )}
              {!p.active && <span className="@lg:hidden">Inativo</span>}
              {semFoto && (
                <span className="font-semibold text-amber-700 @2xl:hidden dark:text-amber-400">
                  Sem foto
                </span>
              )}
            </span>
          </span>
        </Link>
      </td>

      <td className={`${td} hidden @3xl:table-cell`}>
        <span className="block">{p.category ?? "—"}</span>
        {DEPARTMENT_COLUMN_READY && (
          <span className="block text-xs text-muted">
            {DEPARTMENT_VALUE_LABELS[p.department]}
          </span>
        )}
      </td>

      {/* Promoção empilhada (cheio riscado em cima) em vez de lado a lado:
          lado a lado a coluna dobrava de largura. */}
      <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
        {p.onPromo && p.basePrice != null && (
          <span className="block text-xs text-muted line-through">
            {formatBRL(p.basePrice)}
          </span>
        )}
        {p.price != null ? formatBRL(p.price) : "—"}
      </td>

      <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
        {p.variants === 0 ? (
          <span className="text-muted">sem grade</span>
        ) : p.stock <= 0 ? (
          <span className="font-semibold text-red-700 dark:text-red-400">
            Esgotado
          </span>
        ) : isLowStock(p) ? (
          <span className="font-semibold text-amber-700 dark:text-amber-400">
            {p.stock} <span className="text-xs font-medium">baixo</span>
          </span>
        ) : (
          p.stock
        )}
        {/* Era "2 de 10 tamanhos zerados" — a frase alargava a coluna mais
            que o número. Ficou o essencial, com a frase inteira no title. */}
        {p.stock > 0 && p.variantsOut > 0 && (
          <span
            title={`${p.variantsOut} de ${p.variants} tamanhos zerados`}
            className="hidden text-xs text-muted @4xl:block"
          >
            {p.variantsOut}/{p.variants} zerados
          </span>
        )}
      </td>

      <td
        className={`${td} hidden whitespace-nowrap text-right tabular-nums @2xl:table-cell`}
      >
        {semFoto ? (
          <span className="font-semibold text-amber-700 dark:text-amber-400">
            sem foto
          </span>
        ) : (
          <span className="text-muted">{p.images}</span>
        )}
        <span className="block text-xs text-muted">
          {p.colors} {p.colors === 1 ? "cor" : "cores"}
        </span>
      </td>

      <td className={`${td} hidden whitespace-nowrap @lg:table-cell`}>
        <span
          className={`inline-flex items-center gap-1.5 ${p.active ? "" : "text-muted"}`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${p.active ? "bg-green-600" : "bg-muted/50"}`}
          />
          {p.active ? "Ativo" : "Inativo"}
        </span>
      </td>

      <td className={`${td} hidden @2xl:table-cell`}>
        <div className="flex justify-center">
          <FeaturedStar productId={p.id} featured={p.featured} />
        </div>
      </td>

      <td className={`${td} hidden text-right @md:table-cell`}>
        <Link
          href={`/admin/produtos/${p.id}`}
          className="font-semibold underline underline-offset-4"
        >
          Editar
        </Link>
      </td>
    </tr>
  );
}
