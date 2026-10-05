import Link from "next/link";
import { AREAS } from "@/lib/audit-labels";
import type { AuditEventoDetalhe } from "@/lib/audit-queries";

/**
 * Conteúdo do modal de um evento. Em cima, o que uma pessoa pergunta (quem,
 * quando, o quê, em qual item); embaixo, separado, o que só serve para
 * investigar (código da ação, IP, navegador, `metadata` cru).
 */
export function LogDetail({ e }: { e: AuditEventoDetalhe }) {
  const quando = new Date(e.createdAt).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const meta = Object.entries(e.metadata);

  return (
    <div className="space-y-6 text-sm">
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[8rem_1fr] sm:gap-y-3">
        <Campo rotulo="Quem">
          {e.quemNome ? (
            <>
              {e.quemNome}
              {e.quemEmail && e.quemEmail !== e.quemNome && (
                <span className="block text-muted">{e.quemEmail}</span>
              )}
              <span className="block text-muted">
                {e.equipe ? "Equipe" : "Cliente"}
              </span>
            </>
          ) : (
            "Automático (o site ou o sistema, sem pessoa)"
          )}
        </Campo>
        <Campo rotulo="Quando">{quando}</Campo>
        <Campo rotulo="Área">
          {AREAS[e.area]}
          {e.automatico && <span className="text-muted"> (automático)</span>}
        </Campo>
        <Campo rotulo="Item">
          {e.item ? (
            e.itemHref ? (
              <Link
                href={e.itemHref}
                prefetch={false}
                className="font-medium underline underline-offset-4"
              >
                {e.itemHref.startsWith("/admin/pedidos") ? `Pedido ${e.item}` : e.item}
              </Link>
            ) : (
              e.item
            )
          ) : (
            <span className="text-muted">Nenhum</span>
          )}
        </Campo>
      </dl>

      <section className="rounded-sm border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold">Dados técnicos</h3>
        <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-[8rem_1fr] sm:gap-y-2">
          <Campo rotulo="Código da ação" mono>
            {e.action}
            {!e.acaoConhecida && (
              <span className="block font-sans text-muted">
                Ação sem tradução cadastrada (src/lib/audit-labels.ts).
              </span>
            )}
          </Campo>
          <Campo rotulo="Evento" mono>
            #{e.id}
          </Campo>
          <Campo rotulo="IP" mono>
            {e.ip ?? "—"}
          </Campo>
          {e.userAgent && (
            <Campo rotulo="Navegador" mono>
              {e.userAgent}
            </Campo>
          )}
          {meta.map(([k, v]) => (
            <Campo key={k} rotulo={k} mono>
              {valor(v)}
            </Campo>
          ))}
        </dl>
      </section>
    </div>
  );
}

function Campo({
  rotulo,
  mono,
  children,
}: {
  rotulo: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt
        className={`pt-2 text-muted first:pt-0 sm:pt-0 ${mono ? "font-mono" : ""}`}
      >{rotulo}</dt>
      <dd className={`min-w-0 break-words ${mono ? "font-mono" : ""}`}>
        {children}
      </dd>
    </>
  );
}

function valor(v: unknown): React.ReactNode {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "string" || typeof v === "number") return String(v);
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap">
      {JSON.stringify(v, null, 2)}
    </pre>
  );
}
