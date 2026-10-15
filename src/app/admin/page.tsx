import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { getAdminOverview } from "@/lib/admin-overview";
import {
  DETALHES,
  PERIODOS_DETALHE,
  getAudience,
  getAudienceDetail,
  isDetalheKind,
  type DetalheKind,
  type PeriodoDetalhe,
  toPeriodoDetalhe,
} from "@/lib/analytics";
import { OverviewView } from "./overview-view";
import { AudienceModal } from "./audience-modal";
import { AudienceDetailView, DetalheCarregando } from "./audience-detail";
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

  // O detalhe NÃO entra aqui: ele é a parte lenta (ida ao Google, cache de só
  // 1 min no "agora") e segurava a tela inteira até voltar. Agora é streamado
  // dentro do modal — ver `DetalheConteudo`.
  const [overview, audience] = await Promise.all([
    serviceRoleMissing ? null : getAdminOverview(),
    getAudience(),
  ]);

  return (
    <>
      <OverviewView
        overview={overview}
        audience={audience}
        serviceRoleMissing={serviceRoleMissing}
        semAcesso={sp["sem-acesso"] === "1"}
      />
      {detalhe && (
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
          {/* `key` por tipo+período: trocar a aba de período monta uma
              fronteira nova, que mostra o esqueleto em vez de deixar a tabela
              do período anterior na tela fingindo ser a nova. */}
          <Suspense key={`${detalhe}-${periodo}`} fallback={<DetalheCarregando />}>
            <DetalheConteudo kind={detalhe} periodo={periodo} />
          </Suspense>
        </AudienceModal>
      )}
    </>
  );
}

/** Busca e desenha o detalhe — fica atrás de um Suspense, então o modal já
 * está na tela (com o esqueleto) enquanto isto espera o Google. */
async function DetalheConteudo({
  kind,
  periodo,
}: {
  kind: DetalheKind;
  periodo: PeriodoDetalhe;
}) {
  return <AudienceDetailView result={await getAudienceDetail(kind, periodo)} />;
}
