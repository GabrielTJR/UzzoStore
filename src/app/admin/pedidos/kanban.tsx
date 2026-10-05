import Link from "next/link";
import {
  colunaKanban,
  fulfillmentLabel,
  nextFulfillmentStatus,
  podeAvancarAtendimento,
  aceitaPagamentoManual,
  type AdminOrder,
  type KanbanColuna,
} from "@/lib/admin-orders";
import { formatBRL } from "@/lib/format";
import { updateFulfillmentAction, updatePaymentStatusAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";

/**
 * As colunas do quadro, na ordem em que o pedido anda.
 *
 * São 5, não as 6 etapas de `KANBAN_COLUNAS`: "pronto para retirada" e
 * "enviado" são a MESMA altura do caminho (a loja já fez a parte dela e
 * espera o cliente) para dois tipos de pedido diferentes. Em colunas separadas
 * uma das duas ficava quase sempre vazia e o quadro não cabia na tela; juntas,
 * o cartão diz qual é o caso.
 */
const COLUNAS: { label: string; dica: string; etapas: KanbanColuna[] }[] = [
  {
    label: "Aguardando pagamento",
    dica: "Ainda não pode ser separado",
    etapas: ["aguardando_pagamento"],
  },
  { label: "A separar", dica: "Pago, esperando alguém pegar", etapas: ["a_separar"] },
  { label: "Separando", dica: "Em preparo na loja", etapas: ["preparing"] },
  {
    label: "Pronto ou enviado",
    dica: "Esperando retirada ou a caminho",
    etapas: ["ready", "shipped"],
  },
  { label: "Concluído", dica: "Entregues mais recentes", etapas: ["done"] },
];

/** Quantos concluídos o quadro mostra — o histórico completo fica na lista. */
const CONCLUIDOS_NO_QUADRO = 8;

function haQuanto(iso: string, agora: number): string {
  const min = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

/** Prazo do pagamento online (a reserva da peça cai junto com ele). */
function prazo(expiresAt: string | null, agora: number): string | null {
  if (!expiresAt) return null;
  const min = Math.round((new Date(expiresAt).getTime() - agora) / 60000);
  return min > 0 ? `expira em ${min} min` : "prazo vencido";
}

const etiqueta =
  "rounded-xs bg-surface px-1.5 py-0.5 text-[0.7rem] font-medium leading-none";

/**
 * QUADRO DE PEDIDOS — a visão padrão de /admin/pedidos.
 *
 * Cada coluna é uma etapa do caminho do pedido; bater o olho mostra onde está
 * cada um e onde a fila está parando. O cartão traz só o que decide a ação
 * (quem, o quê, quanto, há quanto tempo) e o botão que leva à PRÓXIMA etapa.
 *
 * Não tem arrastar-e-soltar de propósito: avançar um pedido tem regra (o
 * atendimento só anda com pagamento confirmado, e no pedido online quem
 * confirma é o provedor, nunca um clique). Um botão por cartão deixa a regra
 * visível; um arrasto errado no celular marcaria como enviado o que não saiu.
 *
 * A lista (`?vista=lista`) continua existindo para o detalhe completo e para
 * achar pedido antigo, cancelado ou expirado.
 */
export function PedidosKanban({ orders }: { orders: AdminOrder[] }) {
  // Lido uma vez por renderização (Server Component): todos os cartões usam o
  // mesmo "agora".
  const agora = new Date().getTime();
  const colunaDe = (o: AdminOrder) =>
    colunaKanban(o.paymentStatus, o.fulfillmentStatus);
  const fora = orders.filter((o) => colunaDe(o) === null);

  if (orders.length === 0) {
    return (
      <p className="rounded-sm border border-dashed border-border bg-background p-8 text-sm text-muted">
        Nenhum pedido ainda. Eles entram aqui, na primeira coluna, assim que
        alguém fechar uma compra.
      </p>
    );
  }

  return (
    <div>
      {/* Em tela larga as 5 colunas dividem a largura toda; abaixo disso a
          fila rola na horizontal (quebrar em linhas destruiria a leitura de
          esquerda para a direita, que é o ponto do quadro). */}
      <div className="grid snap-x grid-flow-col auto-cols-[minmax(15.5rem,1fr)] gap-3 overflow-x-auto pb-4 min-[1400px]:auto-cols-fr">
        {COLUNAS.map((col) => {
          const todos = orders.filter((o) => {
            const c = colunaDe(o);
            return c !== null && col.etapas.includes(c);
          });
          const ehConcluido = col.etapas.includes("done");
          const visiveis = ehConcluido
            ? todos.slice(0, CONCLUIDOS_NO_QUADRO)
            : todos;
          const soma = todos.reduce((s, o) => s + o.total, 0);

          return (
            <section
              key={col.label}
              aria-label={col.label}
              className="flex min-w-0 snap-start flex-col rounded-sm bg-background/60 p-2.5 ring-1 ring-border"
            >
              {/* A dica da etapa vai no `title` (aparece ao parar o mouse): em
                  texto ela disputava a linha com o valor e quebrava em duas. */}
              <header className="mb-2.5 px-1" title={col.dica}>
                <p className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {todos.length}
                  </span>
                </p>
                <p className="text-xs tabular-nums text-muted">
                  {todos.length > 0 && !ehConcluido
                    ? formatBRL(soma)
                    : col.dica}
                </p>
              </header>

              <ul className="space-y-2">
                {visiveis.map((o) => {
                  const next = nextFulfillmentStatus(
                    o.fulfillmentStatus,
                    o.shippingMethod,
                  );
                  const travado = !podeAvancarAtendimento(o.paymentStatus);
                  const pecas = o.items.reduce((s, i) => s + i.qty, 0);
                  const primeiro = o.items[0];
                  const retirada = o.shippingMethod === "pickup";
                  const expira =
                    o.paymentStatus === "pending"
                      ? prazo(o.expiresAt, agora)
                      : null;
                  // Pago, mas com o atendimento cancelado: o caso que não pode
                  // passar batido (pagamento fora do prazo, peça já devolvida).
                  const pagoCancelado =
                    o.paymentStatus === "paid" &&
                    o.fulfillmentStatus === "canceled";

                  return (
                    <li
                      key={o.id}
                      className={`rounded-xs border bg-background p-3 text-sm ${
                        o.isNew
                          ? "border-accent shadow-[inset_3px_0_0_var(--accent)]"
                          : "border-border"
                      }`}
                    >
                      <p className="flex items-baseline justify-between gap-2">
                        <Link
                          href={`/admin/pedidos?vista=lista#pedido-${o.number}`}
                          prefetch={false}
                          className="font-semibold underline-offset-4 hover:underline"
                        >
                          nº {o.number}
                        </Link>
                        <span className="font-semibold tabular-nums">
                          {formatBRL(o.total)}
                        </span>
                      </p>

                      <p className="mt-1 truncate">
                        {o.customerName ?? "Visitante sem conta"}
                      </p>
                      {primeiro && (
                        <p className="truncate text-xs text-muted">
                          {primeiro.productName}
                          {o.items.length > 1 &&
                            ` e mais ${o.items.length - 1}`}
                        </p>
                      )}

                      <p className="mt-2 flex flex-wrap items-center gap-1">
                        {o.isNew && (
                          <span className="rounded-xs bg-accent px-1.5 py-0.5 text-[0.7rem] font-bold leading-none text-accent-foreground">
                            novo
                          </span>
                        )}
                        <span className={etiqueta}>
                          {retirada ? "Retirada" : "Entrega"}
                        </span>
                        <span className={etiqueta}>
                          {pecas} {pecas === 1 ? "peça" : "peças"}
                        </span>
                        {o.channel === "whatsapp" && (
                          <span className={etiqueta}>WhatsApp</span>
                        )}
                        {o.fulfillmentStatus === "shipped" && (
                          <span className={etiqueta}>
                            {o.trackingCode ? "com rastreio" : "sem rastreio"}
                          </span>
                        )}
                      </p>

                      <p className="mt-2 text-xs text-muted">
                        {haQuanto(o.createdAt, agora)}
                        {expira && `, ${expira}`}
                      </p>

                      {pagoCancelado && (
                        <p className="mt-2 rounded-xs bg-red-600/10 px-2 py-1.5 text-xs font-medium text-red-700 dark:text-red-400">
                          Pago, mas o atendimento está cancelado. Abra o pedido
                          e resolva com o cliente.
                        </p>
                      )}

                      {/* No online o pagamento é do provedor: aqui só o
                          WhatsApp ganha botão, senão viraria porta para marcar
                          como pago o que não foi. */}
                      {travado && aceitaPagamentoManual(o.channel) && (
                        <form
                          action={updatePaymentStatusAction}
                          className="mt-2.5"
                        >
                          <input type="hidden" name="orderId" value={o.id} />
                          <input type="hidden" name="status" value="paid" />
                          <SubmitButton
                            pendingText="Confirmando…"
                            className="h-9 w-full rounded-xs border border-green-700 text-xs font-semibold text-green-700 hover:bg-green-700 hover:text-white dark:border-green-500 dark:text-green-400"
                          >
                            Confirmar pagamento
                          </SubmitButton>
                        </form>
                      )}

                      {next && !travado && !pagoCancelado && (
                        <form
                          action={updateFulfillmentAction}
                          className="mt-2.5"
                        >
                          <input type="hidden" name="orderId" value={o.id} />
                          <input type="hidden" name="status" value={next} />
                          <SubmitButton
                            pendingText="Salvando…"
                            className="h-9 w-full rounded-xs bg-foreground text-xs font-semibold text-background hover:opacity-90"
                          >
                            {fulfillmentLabel(next)}
                          </SubmitButton>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>

              {todos.length === 0 && (
                <p className="rounded-xs border border-dashed border-border px-3 py-6 text-center text-xs text-muted">
                  Nenhum pedido nesta etapa
                </p>
              )}

              {ehConcluido && todos.length > visiveis.length && (
                <Link
                  href="/admin/pedidos?vista=lista"
                  prefetch={false}
                  className="mt-2 block px-1 text-xs text-muted underline underline-offset-4 hover:text-foreground"
                >
                  Mais {todos.length - visiveis.length} na lista
                </Link>
              )}
            </section>
          );
        })}
      </div>

      {fora.length > 0 && (
        <p className="mt-1 text-sm text-muted">
          {fora.length}{" "}
          {fora.length === 1
            ? "pedido cancelado, expirado ou estornado fica"
            : "pedidos cancelados, expirados ou estornados ficam"}{" "}
          fora do quadro.{" "}
          <Link
            href="/admin/pedidos?vista=lista"
            prefetch={false}
            className="text-foreground underline underline-offset-4"
          >
            Ver na lista
          </Link>
        </p>
      )}
    </div>
  );
}
