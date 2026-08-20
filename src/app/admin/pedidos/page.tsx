import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import {
  getAdminOrders,
  PAYMENT_STATUS,
  FULFILLMENT_STATUS,
  fulfillmentSteps,
  nextFulfillmentStatus,
  fulfillmentLabel,
  podeAvancarAtendimento,
  aceitaPagamentoManual,
  situacaoCliente,
  type PaymentStatus,
} from "@/lib/admin-orders";
import { formatBRL } from "@/lib/format";
import {
  updateFulfillmentAction,
  updatePaymentStatusAction,
  markOrdersSeenAction,
  updateOrderTrackingAction,
} from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { PedidosKanban } from "./kanban";

export const metadata: Metadata = { title: "Pedidos" };

const PAGAMENTO_STYLE: Record<string, string> = {
  pending: "border-amber-500 text-amber-700 dark:text-amber-400",
  paid: "border-green-600 text-green-700 dark:text-green-400",
  expired: "border-border text-muted line-through",
  refunded: "border-blue-500 text-blue-700 dark:text-blue-400",
  canceled: "border-border text-muted line-through",
};

export default async function PedidosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  await requireAdmin();
  const orders = await getAdminOrders();
  const novos = orders.filter((o) => o.isNew).length;
  // A lista responde "o que houve com o pedido X"; o quadro responde "o que
  // fazer agora". A vista vive na URL para o admin poder fixar a que usa.
  const kanban = (await searchParams).vista === "kanban";

  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/admin"
        className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        ← Produtos
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">
        Pedidos
      </h1>
      <p className="mt-2 text-sm text-muted">
        Pedidos feitos pelo site. Quem fecha pelo WhatsApp também aparece aqui,
        com o número que o cliente citou na conversa.
      </p>

      {novos > 0 && (
        <form action={markOrdersSeenAction} className="mt-6">
          <SubmitButton
            pendingText="Marcando…"
            className="h-9 rounded-full border border-border px-5 text-sm font-medium hover:border-foreground"
          >
            Marcar {novos} {novos === 1 ? "pedido novo" : "pedidos novos"} como
            visto{novos === 1 ? "" : "s"}
          </SubmitButton>
        </form>
      )}

      <div className="mt-6 flex gap-2 text-sm">
        <Link
          href="/admin/pedidos"
          prefetch={false}
          className={`rounded-full border px-4 py-1.5 ${
            kanban
              ? "border-border text-muted hover:border-foreground hover:text-foreground"
              : "border-foreground font-medium"
          }`}
        >
          Lista
        </Link>
        <Link
          href="/admin/pedidos?vista=kanban"
          prefetch={false}
          className={`rounded-full border px-4 py-1.5 ${
            kanban
              ? "border-foreground font-medium"
              : "border-border text-muted hover:border-foreground hover:text-foreground"
          }`}
        >
          Quadro
        </Link>
      </div>

      {kanban && <PedidosKanban orders={orders} />}

      {!kanban && (
        <div className="mt-8 space-y-4">
          {orders.map((o) => {
            const next = nextFulfillmentStatus(
              o.fulfillmentStatus,
              o.shippingMethod,
            );
            // O eixo físico não anda sem o dinheiro dentro.
            const travado = !podeAvancarAtendimento(o.paymentStatus);
            return (
              <div
                key={o.id}
                className={`rounded-lg border p-5 ${
                  o.isNew ? "border-red-500/60 bg-red-500/5" : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {o.isNew && (
                        <span className="mr-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                          NOVO
                        </span>
                      )}
                      Pedido nº {o.number}
                      <span
                        className={`ml-3 rounded-full border px-2 py-0.5 text-xs font-normal ${
                          PAGAMENTO_STYLE[o.paymentStatus] ??
                          "border-border text-muted"
                        }`}
                      >
                        {situacaoCliente(o.paymentStatus, o.fulfillmentStatus)}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {new Date(o.createdAt).toLocaleString("pt-BR")} ·{" "}
                      {o.customerName ?? "visitante sem conta"}
                      {o.customerPhone ? ` · ${o.customerPhone}` : ""}
                      {o.channel === "online"
                        ? " · pago no site"
                        : " · WhatsApp"}
                    </p>
                  </div>
                  <p className="text-lg font-medium">{formatBRL(o.total)}</p>
                </div>

                <ul className="mt-3 space-y-1 text-sm text-muted">
                  {o.items.map((i, k) => (
                    <li key={k}>
                      {i.qty}× {i.productName}
                      {i.variantLabel ? ` — ${i.variantLabel}` : ""} ·{" "}
                      {formatBRL(i.unitPrice * i.qty)}
                    </li>
                  ))}
                </ul>

                {/* Entrega: sem isso não dá para saber se retira ou para onde enviar */}
                {o.shippingMethod === "pickup" && (
                  <p className="mt-3 rounded-md border border-border px-3 py-2 text-sm">
                    🏬 <span className="font-medium">Retirada na loja</span>
                  </p>
                )}
                {o.shippingMethod === "delivery" && o.shippingAddress && (
                  <p className="mt-3 rounded-md border border-border px-3 py-2 text-sm">
                    🚚 <span className="font-medium">Entrega</span>
                    <span className="block text-muted">
                      {o.shippingAddress.street}
                      {o.shippingAddress.number
                        ? `, ${o.shippingAddress.number}`
                        : ""}
                      {o.shippingAddress.complement
                        ? ` — ${o.shippingAddress.complement}`
                        : ""}
                      {o.shippingAddress.district
                        ? `, ${o.shippingAddress.district}`
                        : ""}{" "}
                      · {o.shippingAddress.city}/{o.shippingAddress.state} · CEP{" "}
                      {o.shippingAddress.cep}
                    </span>
                    {o.customerCpf && (
                      <span className="block text-muted">
                        CPF do cliente: {o.customerCpf}
                      </span>
                    )}
                    {o.shippingService && (
                      <span className="block text-muted">
                        Frete: {o.shippingService} —{" "}
                        {o.shippingCost > 0
                          ? formatBRL(o.shippingCost)
                          : "grátis"}
                      </span>
                    )}
                    {o.couponCode && (
                      <span className="block text-muted">
                        Cupom {o.couponCode}: −{formatBRL(o.discount)}
                      </span>
                    )}
                  </p>
                )}

                {/* Rastreio: salve ANTES de avançar para "enviado" — o e-mail ao
                cliente sai com o link do código que estiver salvo aqui. */}
                {o.shippingMethod === "delivery" &&
                  o.fulfillmentStatus !== "canceled" && (
                    <form
                      action={updateOrderTrackingAction}
                      className="mt-3 flex flex-wrap items-center gap-2 text-sm"
                    >
                      <input type="hidden" name="orderId" value={o.id} />
                      <label
                        htmlFor={`tracking-${o.id}`}
                        className="text-muted"
                      >
                        Rastreio:
                      </label>
                      <input
                        id={`tracking-${o.id}`}
                        name="tracking"
                        defaultValue={o.trackingCode ?? ""}
                        placeholder="AA123456789BR"
                        className="h-9 w-44 rounded-md border border-border bg-transparent px-3 font-mono text-xs uppercase outline-none focus:border-foreground"
                      />
                      <SubmitButton
                        pendingText="…"
                        className="h-9 rounded-full border border-border px-4 text-xs font-medium hover:border-foreground"
                      >
                        Salvar
                      </SubmitButton>
                    </form>
                  )}

                {/* Dois eixos separados: o dinheiro e o trabalho físico. Um botão
                só para os dois foi o que produziu pedido "pago" sem pagamento. */}
                <div className="mt-4 space-y-4 border-t border-border pt-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-muted">Pagamento:</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        PAGAMENTO_STYLE[o.paymentStatus] ??
                        "border-border text-muted"
                      }`}
                    >
                      {PAYMENT_STATUS[o.paymentStatus as PaymentStatus] ??
                        o.paymentStatus}
                    </span>

                    {aceitaPagamentoManual(o.channel) ? (
                      o.paymentStatus !== "paid" && (
                        <form action={updatePaymentStatusAction}>
                          <input type="hidden" name="orderId" value={o.id} />
                          <input type="hidden" name="status" value="paid" />
                          <SubmitButton
                            pendingText="Salvando…"
                            className="h-8 rounded-full border border-green-600 px-4 text-xs font-medium text-green-700 hover:bg-green-600 hover:text-white dark:text-green-400"
                          >
                            Confirmar pagamento
                          </SubmitButton>
                        </form>
                      )
                    ) : (
                      <span className="text-xs text-muted">
                        automático — quem confirma é a InfinitePay
                      </span>
                    )}

                    {o.expiresAt && o.paymentStatus === "pending" && (
                      <span className="text-xs text-muted">
                        expira {new Date(o.expiresAt).toLocaleString("pt-BR")}
                      </span>
                    )}
                  </div>

                  <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    {fulfillmentSteps(o.shippingMethod).map((s, i, arr) => {
                      const done =
                        arr.indexOf(
                          o.fulfillmentStatus as (typeof arr)[number],
                        ) >= i && o.fulfillmentStatus !== "canceled";
                      const current = o.fulfillmentStatus === s;
                      return (
                        <li key={s} className="flex items-center gap-2">
                          <span
                            className={
                              current
                                ? "font-medium text-foreground"
                                : done
                                  ? "text-green-700 dark:text-green-400"
                                  : "text-muted"
                            }
                          >
                            {done && !current ? "✓ " : ""}
                            {FULFILLMENT_STATUS[s]}
                          </span>
                          {i < arr.length - 1 && (
                            <span className="text-muted">→</span>
                          )}
                        </li>
                      );
                    })}
                    {o.fulfillmentStatus === "canceled" && (
                      <li className="font-medium text-red-600">Cancelado</li>
                    )}
                  </ol>

                  <div className="flex flex-wrap items-center gap-3">
                    {next && travado && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        O atendimento só avança depois do pagamento confirmado.
                      </p>
                    )}
                    {next && !travado && (
                      <form action={updateFulfillmentAction}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <input type="hidden" name="status" value={next} />
                        <SubmitButton
                          pendingText="Salvando…"
                          className="h-9 rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
                        >
                          {fulfillmentLabel(next)}
                        </SubmitButton>
                      </form>
                    )}

                    {o.fulfillmentStatus !== "canceled" &&
                      o.fulfillmentStatus !== "done" && (
                        <form action={updateFulfillmentAction}>
                          <input type="hidden" name="orderId" value={o.id} />
                          <input type="hidden" name="status" value="canceled" />
                          <SubmitButton
                            pendingText="…"
                            className="text-sm text-red-600 underline-offset-4 hover:underline dark:text-red-400"
                          >
                            Cancelar pedido
                          </SubmitButton>
                        </form>
                      )}

                    {/* Correção manual do ATENDIMENTO. O pagamento não entra aqui:
                    no online ele é do provedor, e no WhatsApp já tem o botão
                    próprio acima. */}
                    <details className="ml-auto text-xs text-muted">
                      <summary className="cursor-pointer select-none hover:text-foreground">
                        corrigir atendimento
                      </summary>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(
                          Object.keys(
                            FULFILLMENT_STATUS,
                          ) as (keyof typeof FULFILLMENT_STATUS)[]
                        ).map((s) => (
                          <form key={s} action={updateFulfillmentAction}>
                            <input type="hidden" name="orderId" value={o.id} />
                            <input type="hidden" name="status" value={s} />
                            <SubmitButton
                              disabled={o.fulfillmentStatus === s}
                              pendingText="…"
                              className="h-7 rounded-full border border-border px-3 text-xs hover:border-foreground disabled:opacity-40"
                            >
                              {FULFILLMENT_STATUS[s]}
                            </SubmitButton>
                          </form>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            );
          })}

          {orders.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted">
              Nenhum pedido ainda. Os pedidos aparecem aqui assim que um cliente
              finalizar a compra pelo site.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
