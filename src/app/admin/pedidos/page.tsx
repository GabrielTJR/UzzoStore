import Link from "next/link";
import type { Metadata } from "next";
import { requireArea } from "@/lib/admin";
import {
  getAdminOrderByNumber,
  getAdminOrders,
  getBoardOrders,
} from "@/lib/admin-orders";
import { formatBRL } from "@/lib/format";
import { markOrdersSeenAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader } from "../admin-ui";
import { PedidosKanban } from "./kanban";
import { OrderDetail } from "./order-detail";
import { OrderModal } from "./order-modal";
import { pedidosHref } from "./href";

export const metadata: Metadata = { title: "Pedidos" };

/** Sinal de pedido novo — o mesmo do quadro e da Visão geral. */
const seloNovo =
  "rounded-xs bg-accent px-1.5 py-0.5 text-[0.7rem] font-bold leading-none text-accent-foreground";

export default async function PedidosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    vista?: string | string[];
    pedido?: string | string[];
  }>;
}) {
  await requireArea("pedidos");
  const sp = await searchParams;
  const kanbanVista = sp.vista !== "lista";
  const orders = kanbanVista ? await getBoardOrders() : await getAdminOrders();
  const novos = orders.filter((o) => o.isNew).length;
  // O QUADRO é a visão padrão (out/2026, pedido do dono): responde "em que
  // etapa está cada pedido e o que fazer agora". A lista (`?vista=lista`)
  // responde "o que houve com o pedido X" — histórico completo, cancelados,
  // expirados. A vista vive na URL para o admin poder fixar a que usa.
  const kanban = sp.vista !== "lista";
  const vista = kanban ? "quadro" : "lista";

  // Pedido aberto no modal (`?pedido=<número>`). Sai da MESMA leitura que já
  // alimenta a tela — nenhuma consulta a mais — e só ELE vira detalhe no HTML.
  // Número que não existe (ou texto qualquer no parâmetro) é ignorado: a tela
  // abre normal, sem modal e sem erro.
  const numero =
    typeof sp.pedido === "string" && /^\d{1,9}$/.test(sp.pedido)
      ? Number(sp.pedido)
      : null;
  // Pedido fora da tela (antigo, cancelado, expirado — o link do registro
  // de atividades leva a qualquer um): uma leitura só dele.
  const aberto =
    numero === null
      ? null
      : (orders.find((o) => o.number === numero) ??
        (await getAdminOrderByNumber(numero)));

  const aba = (ativa: boolean) =>
    `inline-flex h-10 items-center px-4 text-sm ${
      ativa
        ? "bg-foreground font-semibold text-background"
        : "bg-background text-muted hover:text-foreground"
    }`;

  return (
    <section>
      <PageHeader
        title="Pedidos"
        description="Pedidos do site e os fechados pelo WhatsApp, com o número que o cliente citou na conversa."
      >
        {novos > 0 && (
          <form action={markOrdersSeenAction}>
            <SubmitButton
              pendingText="Marcando…"
              className="h-10 rounded-xs border border-border bg-background px-4 text-sm font-medium hover:border-foreground"
            >
              Marcar {novos} {novos === 1 ? "novo" : "novos"} como visto
              {novos === 1 ? "" : "s"}
            </SubmitButton>
          </form>
        )}
        {/* Só UMA das vistas é renderizada: mandar as duas escondendo uma com
            CSS dobrava o HTML de toda visita. */}
        <div className="flex overflow-hidden rounded-xs border border-border">
          <Link
            href={pedidosHref("quadro")}
            prefetch={false}
            aria-current={kanban ? "page" : undefined}
            className={aba(kanban)}
          >
            Quadro
          </Link>
          <Link
            href={pedidosHref("lista")}
            prefetch={false}
            aria-current={kanban ? undefined : "page"}
            className={`${aba(!kanban)} border-l border-border`}
          >
            Lista
          </Link>
        </div>
      </PageHeader>

      {kanban && <PedidosKanban orders={orders} />}

      {!kanban && (
        <div className="max-w-5xl space-y-4">
          {orders.map((o) => (
            <article
              key={o.id}
              // Âncora do pedido na lista (`/admin/pedidos?vista=lista#pedido-1007`).
              id={`pedido-${o.number}`}
              aria-labelledby={`pedido-${o.number}-titulo`}
              className={`scroll-mt-6 rounded-sm border bg-background p-5 ${
                o.isNew
                  ? "border-accent shadow-[inset_3px_0_0_var(--accent)]"
                  : "border-border"
              }`}
            >
              <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-4">
                <h2
                  id={`pedido-${o.number}-titulo`}
                  className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-semibold"
                >
                  Pedido nº {o.number}
                  {o.isNew && <span className={seloNovo}>novo</span>}
                  <span className="font-normal text-muted">
                    {o.customerName ?? "Visitante sem conta"}
                  </span>
                </h2>
                <p className="text-lg font-semibold tabular-nums">
                  {formatBRL(o.total)}
                </p>
              </header>

              {/* O MESMO detalhe que o modal do quadro abre — fonte única. */}
              <OrderDetail order={o} idPrefix="lista" />
            </article>
          ))}

          {orders.length === 0 && (
            <p className="rounded-sm border border-dashed border-border p-6 text-sm text-muted">
              Nenhum pedido ainda. Os pedidos aparecem aqui assim que um cliente
              finalizar a compra pelo site.
            </p>
          )}
        </div>
      )}

      {/* Depois de uma ação (avançar, salvar rastreio…) o modal CONTINUA
          aberto: as server actions só revalidam `/admin/pedidos`, sem
          redirecionar, então a tela se refaz no mesmo endereço — com o
          `?pedido=` — e o detalhe já vem na nova situação. A `key` troca a
          instância se o endereço passar de um pedido para outro. */}
      {aberto && (
        <OrderModal
          key={aberto.id}
          number={aberto.number}
          title={`Pedido nº ${aberto.number}`}
          subtitle={aberto.customerName ?? "Visitante sem conta"}
          closeHref={pedidosHref(vista)}
          aside={
            <>
              {aberto.isNew && <span className={seloNovo}>novo</span>}
              <span className="whitespace-nowrap font-semibold tabular-nums">
                {formatBRL(aberto.total)}
              </span>
            </>
          }
        >
          <OrderDetail order={aberto} idPrefix="modal" />
        </OrderModal>
      )}
    </section>
  );
}
