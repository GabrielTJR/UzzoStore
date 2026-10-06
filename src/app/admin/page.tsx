import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getAdminOverview } from "@/lib/admin-overview";
import {
  DETALHES,
  PERIODOS_DETALHE,
  getAudience,
  getAudienceDetail,
  isDetalheKind,
  toPeriodoDetalhe,
} from "@/lib/analytics";
import { OverviewView } from "./overview-view";
import { AudienceModal } from "./audience-modal";
import { AudienceDetailView } from "./audience-detail";
import { detalheHref } from "./audience";

export const metadata: Metadata = { title: "Visão geral" };

/**
 * Tela de abertura do painel. O desenho fica em `overview-view.tsx`.
 *
 * `?detalhe=<tipo>&periodo=<dias>` abre o modal de detalhe de um card de
 * audiência. Os dois valores passam por lista fechada (`isDetalheKind`,
 * `toPeriodoDetalhe`); qualquer outra coisa na URL é ignorada.
 */
export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    detalhe?: string;
    periodo?: string;
    "sem-acesso"?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const serviceRoleMissing = !process.env.SUPABASE_SERVICE_ROLE_KEY;
  const detalhe = isDetalheKind(sp.detalhe) ? sp.detalhe : null;
  const periodo = toPeriodoDetalhe(sp.periodo);

  const [overview, audience, detail] = await Promise.all([
    serviceRoleMissing ? null : getAdminOverview(),
    getAudience(),
    detalhe ? getAudienceDetail(detalhe, periodo) : null,
  ]);

  return (
    <>
      <OverviewView
        overview={overview}
        audience={audience}
        serviceRoleMissing={serviceRoleMissing}
        semAcesso={sp["sem-acesso"] === "1"}
      />
      {detalhe && detail && (
        // `key`: trocar de card troca a instância (foco e rolagem do início).
        <AudienceModal
          key={detalhe}
          title={DETALHES[detalhe]}
          periodos={
            detalhe === "agora"
              ? null
              : PERIODOS_DETALHE.map((d) => ({
                  rotulo: `${d} dias`,
                  href: detalheHref(detalhe, d),
                  ativo: d === periodo,
                }))
          }
        >
          <AudienceDetailView result={detail} />
        </AudienceModal>
      )}
    </>
  );
}
