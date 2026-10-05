"use client";

import Form from "next/form";
import Link from "next/link";
import type { AuditPessoa } from "@/lib/audit-queries";

const campo =
  "h-9 rounded-xs border border-border bg-background text-sm outline-none focus:border-foreground";
// Mesmo desenho dos filtros de /admin/produtos: a opção vazia leva o NOME do
// filtro, e o filtro em uso fica com borda escura.
const select = (ativo: boolean) =>
  `${campo} max-w-48 pl-2.5 pr-7 ${ativo ? "border-foreground font-medium" : "text-muted"}`;

const PERIODOS: [string, string][] = [
  ["hoje", "Hoje"],
  ["7", "Últimos 7 dias"],
  ["30", "Últimos 30 dias"],
  ["90", "Últimos 90 dias"],
  ["tudo", "Todo o período"],
];

/**
 * Filtros do Registro de atividades. Formulário GET (a URL é o estado — dá
 * para mandar "o que a Ana fez hoje" num link); o `next/form` só evita a
 * recarga. Trocar um select ou a caixinha já filtra; a busca vai no Enter.
 * Filtrar sempre volta para a página 1, porque `pagina` não está no form.
 */
export function LogsFilters({
  valores,
  pessoas,
  areas,
  filtrando,
}: {
  valores: {
    area: string;
    quem: string;
    periodo: string;
    busca: string;
    auto: boolean;
  };
  pessoas: AuditPessoa[];
  /** [valor, rótulo] — vem do servidor: o módulo de rótulos é server-only. */
  areas: [string, string][];
  filtrando: boolean;
}) {
  const equipe = pessoas.filter((p) => p.equipe);
  const clientes = pessoas.filter((p) => !p.equipe);
  return (
    <Form
      action="/admin/logs"
      prefetch={false}
      scroll={false}
      onChange={(e) => {
        const t = e.target;
        if (
          t instanceof HTMLSelectElement ||
          (t instanceof HTMLInputElement && t.type === "checkbox")
        )
          e.currentTarget.requestSubmit();
      }}
      className="mb-4 flex flex-wrap items-center gap-2"
    >
      <input
        type="search"
        name="busca"
        defaultValue={valores.busca}
        placeholder="Buscar pedido, produto, pessoa…"
        aria-label="Buscar no registro"
        className={`${campo} w-full px-3 sm:w-64 xl:w-72`}
      />
      <select
        name="periodo"
        defaultValue={valores.periodo}
        aria-label="Período"
        className={select(valores.periodo !== "7")}
      >
        {PERIODOS.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
      <select
        name="area"
        defaultValue={valores.area}
        aria-label="Área"
        className={select(!!valores.area)}
      >
        <option value="">Todas as áreas</option>
        {areas.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
      <select
        name="quem"
        defaultValue={valores.quem}
        aria-label="Quem"
        className={select(!!valores.quem)}
      >
        <option value="">Todas as pessoas</option>
        {equipe.length > 0 && (
          <optgroup label="Equipe">
            {equipe.map((p) => (
              <option key={p.email} value={p.email}>
                {p.nome}
              </option>
            ))}
          </optgroup>
        )}
        {clientes.length > 0 && (
          <optgroup label="Clientes">
            {clientes.map((p) => (
              <option key={p.email} value={p.email}>
                {p.nome}
              </option>
            ))}
          </optgroup>
        )}
        <option value="auto">Automático (site e sistema)</option>
      </select>
      <label className="flex h-9 cursor-pointer items-center gap-2 px-1.5 text-sm text-muted hover:text-foreground">
        <input
          type="checkbox"
          name="auto"
          value="1"
          defaultChecked={valores.auto}
          className="size-4 accent-[var(--accent)]"
        />
        Mostrar automáticos
      </label>
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
          href="/admin/logs"
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
