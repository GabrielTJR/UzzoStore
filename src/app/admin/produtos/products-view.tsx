import Image from "next/image";
import Link from "next/link";
import { FeaturedStar } from "@/components/featured-star";
import { isLowStock, isSoldOut } from "@/lib/admin-overview";
import type { AdminProductListItem } from "@/lib/admin-products";
import {
  DEPARTMENT_COLUMN_READY,
  DEPARTMENT_VALUES,
  DEPARTMENT_VALUE_LABELS,
} from "@/lib/departments";
import { formatBRL } from "@/lib/format";
import { normalizeSearch } from "@/lib/products";
import { PageHeader, Panel, primaryButton } from "../admin-ui";

export type ProductsSearch = {
  q?: string;
  departamento?: string;
  categoria?: string;
  situacao?: string;
  estoque?: string;
  fotos?: string;
};

const campo =
  "h-10 rounded-xs border border-border bg-background px-3 text-sm outline-none focus:border-foreground";

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

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Buscar por nome ou referência"
          aria-label="Buscar produto"
          className={`${campo} min-w-0 flex-1 basis-64 sm:max-w-sm`}
        />
        {DEPARTMENT_COLUMN_READY && (
          <select
            name="departamento"
            defaultValue={sp.departamento ?? ""}
            aria-label="Departamento"
            className={campo}
          >
            <option value="">Todos os departamentos</option>
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
          className={campo}
        >
          <option value="">Todas as categorias</option>
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
          className={campo}
        >
          <option value="">Ativos e inativos</option>
          <option value="ativo">Só ativos</option>
          <option value="inativo">Só inativos</option>
        </select>
        <select
          name="estoque"
          defaultValue={sp.estoque ?? ""}
          aria-label="Estoque"
          className={campo}
        >
          <option value="">Qualquer estoque</option>
          <option value="baixo">Estoque baixo</option>
          <option value="zerado">Esgotados</option>
        </select>
        <select
          name="fotos"
          defaultValue={sp.fotos ?? ""}
          aria-label="Fotos"
          className={campo}
        >
          <option value="">Com ou sem foto</option>
          <option value="sem">Sem foto</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-xs border border-foreground px-4 text-sm font-semibold"
        >
          Filtrar
        </button>
        {filtrando && (
          <Link
            href="/admin/produtos"
            className="px-2 text-sm text-muted underline underline-offset-4 hover:text-foreground"
          >
            Limpar
          </Link>
        )}
      </form>

      <Panel className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Produto</th>
              {DEPARTMENT_COLUMN_READY && (
                <th className="hidden px-4 py-3 font-medium lg:table-cell">
                  Departamento
                </th>
              )}
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Categoria
              </th>
              <th className="px-4 py-3 text-right font-medium">Preço</th>
              <th className="px-4 py-3 text-right font-medium">Estoque</th>
              <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">
                Cores
              </th>
              <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">
                Fotos
              </th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                Situação
              </th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Destaque
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-surface/60">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/admin/produtos/${p.id}`}
                    className="flex items-center gap-3"
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
                      <span className="block font-semibold">{p.name}</span>
                      {p.reference && (
                        <span className="block text-xs text-muted">
                          Ref. {p.reference}
                        </span>
                      )}
                    </span>
                  </Link>
                </td>
                {DEPARTMENT_COLUMN_READY && (
                  <td className="hidden px-4 py-2.5 lg:table-cell">
                    {DEPARTMENT_VALUE_LABELS[p.department]}
                  </td>
                )}
                <td className="hidden px-4 py-2.5 text-muted md:table-cell">
                  {p.category ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                  {p.onPromo && p.basePrice != null && (
                    <span className="mr-2 text-xs text-muted line-through">
                      {formatBRL(p.basePrice)}
                    </span>
                  )}
                  {p.price != null ? formatBRL(p.price) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
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
                  {p.stock > 0 && p.variantsOut > 0 && (
                    <span className="block text-xs text-muted">
                      {p.variantsOut} de {p.variants} tamanhos zerados
                    </span>
                  )}
                </td>
                <td className="hidden px-4 py-2.5 text-right tabular-nums text-muted lg:table-cell">
                  {p.colors}
                </td>
                <td className="hidden px-4 py-2.5 text-right tabular-nums lg:table-cell">
                  {p.images === 0 ? (
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      sem foto
                    </span>
                  ) : (
                    <span className="text-muted">{p.images}</span>
                  )}
                </td>
                <td className="hidden px-4 py-2.5 sm:table-cell">
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
                <td className="hidden px-4 py-2.5 md:table-cell">
                  <FeaturedStar productId={p.id} featured={p.featured} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/admin/produtos/${p.id}`}
                    className="font-semibold underline underline-offset-4"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted">
                  {filtrando
                    ? "Nenhum produto com esses filtros."
                    : "Nenhum produto ainda. Comece por “Novo produto”."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
