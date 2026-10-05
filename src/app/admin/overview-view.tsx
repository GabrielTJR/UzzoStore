import Link from "next/link";
import type { AdminOverview } from "@/lib/admin-overview";
import {
  FULFILLMENT_STATUS,
  PAYMENT_STATUS,
  isFulfillmentStatus,
  isPaymentStatus,
} from "@/lib/admin-orders";
import type { AudienceResult } from "@/lib/analytics";
import { formatBRL } from "@/lib/format";
import { PageHeader, Panel, primaryButton, secondaryButton } from "./admin-ui";
import { Audience } from "./audience";

/**
 * Uma pendência: o número e o que ele significa, e o card inteiro é o atalho
 * para a tela onde se resolve. Zerado fica apagado — o olho vai para o que tem
 * trabalho.
 */
function Pendencia({
  href,
  n,
  label,
  hint,
}: {
  href: string;
  n: number;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-sm border border-border bg-background p-4 transition-colors hover:border-foreground lg:p-5"
    >
      <p
        className={`text-3xl font-semibold leading-none ${n === 0 ? "text-muted/60" : ""}`}
      >
        {n}
      </p>
      <p className="mt-2 text-sm font-semibold">{label}</p>
      <p className="mt-0.5 text-xs text-muted">{n === 0 ? "Nada pendente" : hint}</p>
    </Link>
  );
}

const quando = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const hoje = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Sao_Paulo",
});

const secao = "mb-3 font-display text-lg font-bold";

/**
 * VISÃO GERAL — a tela de abertura do painel. Responde, nesta ordem:
 * "o que eu preciso fazer agora?" (pendências), "tem gente na loja?"
 * (audiência do Google Analytics) e "o que entrou por último?" (pedidos).
 *
 * A lista de produtos, que morava aqui, foi para /admin/produtos.
 */
export function OverviewView({
  overview,
  audience,
  serviceRoleMissing,
}: {
  /** `null` quando falta a service_role (o painel não consegue ler pedidos). */
  overview: AdminOverview | null;
  audience: AudienceResult;
  serviceRoleMissing: boolean;
}) {
  return (
    <>
      <PageHeader
        title="Visão geral"
        description={
          <span className="first-letter:uppercase">
            {hoje.format(new Date())}
          </span>
        }
      >
        <Link href="/admin/pedidos" className={secondaryButton}>
          Ver pedidos
        </Link>
        <Link href="/admin/produtos/novo" className={primaryButton}>
          Novo produto
        </Link>
      </PageHeader>

      {serviceRoleMissing && (
        <div className="mb-8 rounded-sm border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Falta configurar <code>SUPABASE_SERVICE_ROLE_KEY</code> no servidor
          (.env.local / Vercel). Sem ela o painel não lê pedidos nem salva
          alterações.
        </div>
      )}

      {overview && (
        <section aria-labelledby="pendencias" className="mb-10">
          <h2 id="pendencias" className={secao}>
            Para resolver
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4 2xl:grid-cols-6">
            <Pendencia
              href="/admin/pedidos"
              n={overview.pedidosNovos}
              label="Pedidos novos"
              hint="Ainda não vistos pela loja"
            />
            <Pendencia
              href="/admin/pedidos?vista=kanban"
              n={overview.aPreparar}
              label="Pagos, a preparar"
              hint="Separar para envio ou retirada"
            />
            <Pendencia
              href="/admin/pedidos"
              n={overview.aguardandoPagamento}
              label="Aguardando pagamento"
              hint="Confira os do WhatsApp"
            />
            <Pendencia
              href="/admin/produtos?estoque=baixo"
              n={overview.estoqueBaixo}
              label="Estoque baixo"
              hint="3 unidades ou menos no total"
            />
            <Pendencia
              href="/admin/produtos?estoque=zerado"
              n={overview.esgotados}
              label="Esgotados"
              hint="Ativos na loja sem nenhuma unidade"
            />
            <Pendencia
              href="/admin/produtos?fotos=sem"
              n={overview.semFoto}
              label="Sem foto"
              hint="Ativos na loja sem imagem"
            />
          </div>
        </section>
      )}

      <section aria-labelledby="audiencia" className="mb-10">
        <h2 id="audiencia" className={secao}>
          Audiência
        </h2>
        <Audience result={audience} />
      </section>

      {overview && (
        <section aria-labelledby="recentes">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="recentes" className="font-display text-lg font-bold">
              Últimos pedidos
            </h2>
            <Link
              href="/admin/pedidos"
              className="text-sm underline underline-offset-4"
            >
              Ver todos
            </Link>
          </div>
          <Panel className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Pedido</th>
                  <th className="px-4 py-3 font-medium">Quando</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Canal</th>
                  <th className="px-4 py-3 font-medium">Pagamento</th>
                  <th className="px-4 py-3 font-medium">Atendimento</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overview.recentes.map((o) => (
                  <tr key={o.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">
                      nº {o.number}
                      {o.isNew && (
                        <span className="ml-2 rounded-xs bg-accent px-1.5 py-0.5 text-[0.7rem] font-bold text-accent-foreground">
                          novo
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {quando.format(new Date(o.createdAt))}
                    </td>
                    <td className="px-4 py-3">{o.customerName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">
                      {o.channel === "whatsapp" ? "WhatsApp" : "Site"}
                    </td>
                    <td className="px-4 py-3">
                      {isPaymentStatus(o.paymentStatus)
                        ? PAYMENT_STATUS[o.paymentStatus]
                        : o.paymentStatus}
                    </td>
                    <td className="px-4 py-3">
                      {isFulfillmentStatus(o.fulfillmentStatus)
                        ? FULFILLMENT_STATUS[o.fulfillmentStatus]
                        : o.fulfillmentStatus}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                      {formatBRL(o.total)}
                    </td>
                  </tr>
                ))}
                {overview.recentes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted">
                      Nenhum pedido ainda. Eles aparecem aqui assim que alguém
                      fechar uma compra.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Panel>
        </section>
      )}
    </>
  );
}
