import type { Metadata } from "next";
import { requireArea } from "@/lib/admin";
import { isArea } from "@/lib/audit-labels";
import {
  LOGS_POR_PAGINA,
  PERIODO_PADRAO,
  getAuditEvent,
  getAuditLog,
  getAuditPessoas,
  isPeriodo,
} from "@/lib/audit-queries";
import { LogsView } from "./logs-view";
import { LogModal } from "./log-modal";
import { LogDetail } from "./log-detail";
import { logsHref } from "./href";

export const metadata: Metadata = { title: "Registro de atividades" };

type Sp = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined;

/**
 * Registro de atividades. Autorização e consultas aqui; o desenho em
 * `logs-view.tsx`.
 *
 * Tudo o que vem da URL passa por lista fechada ou validação (área, período,
 * página, id do evento). `quem` é comparado por igualdade e a busca é limpa
 * em `audit-queries` antes de entrar no filtro.
 */
export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<Sp>;
}) {
  await requireArea("logs");
  const sp = await searchParams;

  const areaSp = um(sp.area);
  const area = isArea(areaSp) ? areaSp : null;
  const periodoSp = um(sp.periodo);
  const periodo = isPeriodo(periodoSp) ? periodoSp : PERIODO_PADRAO;
  const quem = um(sp.quem)?.slice(0, 200) || null;
  const busca = um(sp.busca)?.trim().slice(0, 80) ?? "";
  const auto = um(sp.auto) === "1";
  const paginaNum = Number(um(sp.pagina));
  const pagina =
    Number.isInteger(paginaNum) && paginaNum > 1 && paginaNum < 10_000
      ? paginaNum
      : 1;
  const eventoNum = Number(um(sp.evento));
  const eventoId =
    Number.isInteger(eventoNum) && eventoNum > 0 ? eventoNum : null;

  const filtros = { area, quem, periodo, busca, auto, pagina };
  const [{ eventos, total }, pessoas, evento] = await Promise.all([
    getAuditLog(filtros),
    getAuditPessoas(),
    eventoId ? getAuditEvent(eventoId) : null,
  ]);

  return (
    <>
      <LogsView
        busca={filtros}
        eventos={eventos}
        total={total}
        porPagina={LOGS_POR_PAGINA}
        pessoas={pessoas}
        automaticosOcultos={!auto}
      />
      {evento && (
        <LogModal
          key={evento.id}
          title={evento.frase}
          closeHref={logsHref(filtros)}
        >
          <LogDetail e={evento} />
        </LogModal>
      )}
    </>
  );
}
