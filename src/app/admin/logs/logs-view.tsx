import Link from "next/link";
import { IconChevronRight } from "@/components/icons";
import { AREAS } from "@/lib/audit-labels";
import type { AuditEvento, AuditPessoa } from "@/lib/audit-queries";
import { PageHeader, Panel } from "../admin-ui";
import { LogsFilters } from "./logs-filters";
import { logsHref, type LogsBusca } from "./href";

/**
 * Desenho do Registro de atividades — sem consulta nem autorização (isso é do
 * `page.tsx`), para dar para ver com dados de exemplo.
 *
 * Uma linha por evento, agrupada por dia, com a ação em FRASE. O IP e os dados
 * técnicos saíram da lista: quase nunca importam, e quando importam estão a um
 * clique, no modal do evento.
 */

const FUSO = "America/Sao_Paulo";

const diaDe = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date(iso));

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
  });

/** "Hoje", "Ontem" ou "sexta-feira, 3 de outubro" (com ano se não for este). */
function rotuloDoDia(dia: string, agora: Date): string {
  const hoje = diaDe(agora.toISOString());
  const ontem = diaDe(new Date(agora.getTime() - 86_400_000).toISOString());
  if (dia === hoje) return "Hoje";
  if (dia === ontem) return "Ontem";
  // Meio-dia: longe da virada, o fuso não troca o dia na formatação.
  const d = new Date(`${dia}T12:00:00-03:00`);
  const texto = d.toLocaleDateString("pt-BR", {
    timeZone: FUSO,
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(dia.slice(0, 4) !== hoje.slice(0, 4) ? { year: "numeric" } : {}),
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function LogsView({
  busca,
  eventos,
  total,
  porPagina,
  pessoas,
  automaticosOcultos,
  agora = new Date(),
}: {
  /** Estado atual da URL (sem o evento aberto). */
  busca: Required<Omit<LogsBusca, "evento">>;
  eventos: AuditEvento[];
  total: number;
  porPagina: number;
  pessoas: AuditPessoa[];
  /** Os automáticos estão escondidos (padrão)? Muda o texto do vazio. */
  automaticosOcultos: boolean;
  agora?: Date;
}) {
  const filtrando = Boolean(
    busca.area || busca.quem || busca.busca || busca.auto || busca.periodo !== "7",
  );
  const paginas = Math.max(1, Math.ceil(total / porPagina));

  const grupos: { dia: string; eventos: AuditEvento[] }[] = [];
  for (const e of eventos) {
    const dia = diaDe(e.createdAt);
    const ultimo = grupos.at(-1);
    if (ultimo?.dia === dia) ultimo.eventos.push(e);
    else grupos.push({ dia, eventos: [e] });
  }

  return (
    <section>
      <PageHeader
        title="Registro de atividades"
        description="Quem fez o quê no painel e o que o site fez sozinho. Clique num evento para ver os detalhes."
      />

      <LogsFilters
        valores={{
          area: busca.area ?? "",
          quem: busca.quem ?? "",
          periodo: busca.periodo ?? "7",
          busca: busca.busca ?? "",
          auto: busca.auto,
        }}
        pessoas={pessoas}
        areas={Object.entries(AREAS)}
        filtrando={filtrando}
      />

      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {total === 0
          ? "Nenhum evento"
          : total === 1
            ? "1 evento"
            : `${total.toLocaleString("pt-BR")} eventos`}
        {automaticosOcultos && total > 0 && " (sem os automáticos)"}
      </p>

      {grupos.length === 0 ? (
        <Panel className="px-5 py-12 text-center text-sm text-muted">
          Nada neste período com estes filtros.
          {automaticosOcultos && (
            <>
              {" "}
              <Link
                href={logsHref(busca, { auto: true, pagina: 1 })}
                prefetch={false}
                scroll={false}
                className="text-foreground underline underline-offset-4"
              >
                Ver também os automáticos
              </Link>
            </>
          )}
        </Panel>
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => (
            <section key={g.dia} aria-labelledby={`dia-${g.dia}`}>
              <h2
                id={`dia-${g.dia}`}
                className="mb-2 text-sm font-semibold"
              >
                {rotuloDoDia(g.dia, agora)}
              </h2>
              <Panel>
                <ul className="divide-y divide-border">
                  {g.eventos.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={logsHref(busca, { evento: e.id })}
                        prefetch={false}
                        scroll={false}
                        className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface sm:items-center sm:gap-4"
                      >
                        <time
                          dateTime={e.createdAt}
                          className="w-11 shrink-0 pt-px text-sm tabular-nums text-muted sm:pt-0"
                        >
                          {hora(e.createdAt)}
                        </time>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm leading-snug ${e.automatico ? "text-muted" : ""}`}
                          >
                            {e.frase}
                          </span>
                          <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted sm:hidden">
                            <span>{AREAS[e.area]}</span>
                            {e.automatico && <span>Automático</span>}
                          </span>
                        </span>
                        <span className="hidden w-40 shrink-0 text-right text-xs text-muted sm:block">
                          {e.automatico ? "Automático" : AREAS[e.area]}
                        </span>
                        <IconChevronRight
                          size={16}
                          className="mt-0.5 shrink-0 text-muted transition-colors group-hover:text-foreground sm:mt-0"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            </section>
          ))}
        </div>
      )}

      {paginas > 1 && (
        <nav
          aria-label="Páginas"
          className="mt-6 flex items-center justify-between gap-3 text-sm"
        >
          {busca.pagina > 1 ? (
            <Link
              href={logsHref(busca, { pagina: busca.pagina - 1 })}
              prefetch={false}
              className="inline-flex h-9 items-center rounded-xs border border-border bg-background px-4 hover:border-foreground"
            >
              Mais recentes
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Página {busca.pagina} de {paginas}
          </span>
          {busca.pagina < paginas ? (
            <Link
              href={logsHref(busca, { pagina: busca.pagina + 1 })}
              prefetch={false}
              className="inline-flex h-9 items-center rounded-xs border border-border bg-background px-4 hover:border-foreground"
            >
              Mais antigos
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}

