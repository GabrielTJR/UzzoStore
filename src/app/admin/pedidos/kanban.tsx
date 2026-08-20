import {
  KANBAN_COLUNAS,
  colunaKanban,
  fulfillmentLabel,
  nextFulfillmentStatus,
  podeAvancarAtendimento,
  aceitaPagamentoManual,
  type AdminOrder,
} from "@/lib/admin-orders";
import { formatBRL } from "@/lib/format";
import { updateFulfillmentAction, updatePaymentStatusAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";

/**
 * Quadro de pedidos por etapa de trabalho.
 *
 * A lista responde "o que aconteceu com o pedido nº X"; o quadro responde "o
 * que precisa ser feito agora" — são perguntas diferentes, por isso as duas
 * vistas convivem em vez de uma substituir a outra.
 *
 * Cada cartão traz só o que decide a ação (número, cliente, valor, quantas
 * peças) e o botão da próxima etapa. O detalhe completo fica na lista, a um clique.
 */
export function PedidosKanban({ orders }: { orders: AdminOrder[] }) {
  const fora = orders.filter(
    (o) => colunaKanban(o.paymentStatus, o.fulfillmentStatus) === null,
  );

  return (
    <div className="mt-8">
      {/* Rolagem horizontal: 6 colunas não cabem em tela de celular, e quebrar
        em grade destruiria a leitura de fila que é o ponto do quadro. */}
      <div className="flex snap-x gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUNAS.map((col) => {
          const doColuna = orders.filter(
            (o) =>
              colunaKanban(o.paymentStatus, o.fulfillmentStatus) === col.key,
          );
          return (
            <div
              key={col.key}
              className="w-64 shrink-0 snap-start rounded-lg border border-border bg-black/[0.02] p-3 dark:bg-white/[0.02]"
            >
              <p className="mb-3 flex items-baseline justify-between text-xs font-medium">
                <span>{col.label}</span>
                <span className="text-muted">{doColuna.length}</span>
              </p>

              <div className="space-y-2">
                {doColuna.map((o) => {
                  const next = nextFulfillmentStatus(
                    o.fulfillmentStatus,
                    o.shippingMethod,
                  );
                  const travado = !podeAvancarAtendimento(o.paymentStatus);
                  const pecas = o.items.reduce((s, i) => s + i.qty, 0);
                  return (
                    <div
                      key={o.id}
                      className={`rounded-md border bg-background p-3 text-sm ${
                        o.isNew ? "border-red-500/60" : "border-border"
                      }`}
                    >
                      <p className="flex items-baseline justify-between gap-2 font-medium">
                        <span>
                          {o.isNew && (
                            <span className="mr-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] text-white">
                              NOVO
                            </span>
                          )}
                          nº {o.number}
                        </span>
                        <span>{formatBRL(o.total)}</span>
                      </p>
                      <p className="mt-1 truncate text-xs text-muted">
                        {o.customerName ?? "visitante sem conta"}
                      </p>
                      <p className="text-xs text-muted">
                        {pecas} {pecas === 1 ? "peça" : "peças"} ·{" "}
                        {o.shippingMethod === "pickup" ? "retirada" : "entrega"}
                        {o.channel === "whatsapp" ? " · WhatsApp" : ""}
                      </p>

                      {/* No online o pagamento é do provedor: aqui só o
                        WhatsApp ganha botão, senão viraria porta para marcar
                        como pago o que não foi. */}
                      {travado && aceitaPagamentoManual(o.channel) && (
                        <form
                          action={updatePaymentStatusAction}
                          className="mt-2"
                        >
                          <input type="hidden" name="orderId" value={o.id} />
                          <input type="hidden" name="status" value="paid" />
                          <SubmitButton
                            pendingText="…"
                            className="h-7 w-full rounded-full border border-green-600 text-xs font-medium text-green-700 hover:bg-green-600 hover:text-white dark:text-green-400"
                          >
                            Confirmar pagamento
                          </SubmitButton>
                        </form>
                      )}

                      {next && !travado && (
                        <form action={updateFulfillmentAction} className="mt-2">
                          <input type="hidden" name="orderId" value={o.id} />
                          <input type="hidden" name="status" value={next} />
                          <SubmitButton
                            pendingText="…"
                            className="h-7 w-full rounded-full bg-foreground text-xs font-medium text-background hover:opacity-90"
                          >
                            {fulfillmentLabel(next)}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  );
                })}

                {doColuna.length === 0 && (
                  <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted">
                    vazio
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {fora.length > 0 && (
        <details className="mt-2 text-sm text-muted">
          <summary className="cursor-pointer select-none hover:text-foreground">
            {fora.length} fora do quadro (cancelado, expirado ou estornado)
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {fora.map((o) => (
              <li key={o.id}>
                nº {o.number} · {o.customerName ?? "visitante"} ·{" "}
                {formatBRL(o.total)}
              </li>
            ))}
          </ul>
        </details>
      )}

      {orders.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted">
          Nenhum pedido ainda.
        </p>
      )}
    </div>
  );
}
