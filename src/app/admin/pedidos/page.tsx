import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import {
  getAdminOrders,
  ORDER_STATUS,
  orderSteps,
  nextOrderStatus,
  nextStatusLabel,
} from "@/lib/admin-orders";
import { formatBRL } from "@/lib/format";
import { updateOrderStatusAction, markOrdersSeenAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = { title: "Pedidos" };

const STATUS_STYLE: Record<string, string> = {
  pending: "border-amber-500 text-amber-700 dark:text-amber-400",
  paid: "border-green-600 text-green-700 dark:text-green-400",
  shipped: "border-blue-500 text-blue-700 dark:text-blue-400",
  canceled: "border-border text-muted line-through",
  ready: "border-purple-500 text-purple-700 dark:text-purple-400",
  delivered: "border-green-700 text-green-800 dark:text-green-300",
};

export default async function PedidosAdminPage() {
  await requireAdmin();
  const orders = await getAdminOrders();
  const novos = orders.filter((o) => o.isNew).length;

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
            Marcar {novos} {novos === 1 ? "pedido novo" : "pedidos novos"} como visto{novos === 1 ? "" : "s"}
          </SubmitButton>
        </form>
      )}

      <div className="mt-8 space-y-4">
        {orders.map((o) => {
          const next = nextOrderStatus(o.status, o.shippingMethod);
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
                      STATUS_STYLE[o.status] ?? "border-border text-muted"
                    }`}
                  >
                    {ORDER_STATUS[o.status as keyof typeof ORDER_STATUS] ??
                      o.status}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  {new Date(o.createdAt).toLocaleString("pt-BR")} ·{" "}
                  {o.customerName ?? "visitante sem conta"}
                  {o.customerPhone ? ` · ${o.customerPhone}` : ""}
                  {o.channel === "online" ? " · pago no site" : " · WhatsApp"}
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
                  {o.shippingAddress.number ? `, ${o.shippingAddress.number}` : ""}
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
              </p>
            )}

            {/* Progressão do pedido: mostra em que etapa está e qual é o
                próximo passo, em vez de botões soltos sem ordem. */}
            <div className="mt-4 border-t border-border pt-4">
              <ol className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {orderSteps(o.shippingMethod).map((s, i, arr) => {
                  const done =
                    arr.indexOf(o.status as (typeof arr)[number]) >= i &&
                    o.status !== "canceled";
                  const current = o.status === s;
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
                        {ORDER_STATUS[s]}
                      </span>
                      {i < arr.length - 1 && (
                        <span className="text-muted">→</span>
                      )}
                    </li>
                  );
                })}
                {o.status === "canceled" && (
                  <li className="font-medium text-red-600">Cancelado</li>
                )}
              </ol>

              <div className="flex flex-wrap items-center gap-3">
                {next && (
                  <form action={updateOrderStatusAction}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <input type="hidden" name="status" value={next} />
                    <SubmitButton
                      pendingText="Salvando…"
                      className="h-9 rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
                    >
                      {nextStatusLabel(next)}
                    </SubmitButton>
                  </form>
                )}

                {o.status !== "canceled" && o.status !== "delivered" && (
                  <form action={updateOrderStatusAction}>
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

                {/* Correção manual, para quando alguém avança sem querer. */}
                <details className="ml-auto text-xs text-muted">
                  <summary className="cursor-pointer select-none hover:text-foreground">
                    corrigir situação
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(
                      Object.keys(ORDER_STATUS) as (keyof typeof ORDER_STATUS)[]
                    ).map((s) => (
                      <form key={s} action={updateOrderStatusAction}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <input type="hidden" name="status" value={s} />
                        <SubmitButton
                          disabled={o.status === s}
                          pendingText="…"
                          className="h-7 rounded-full border border-border px-3 text-xs hover:border-foreground disabled:opacity-40"
                        >
                          {ORDER_STATUS[s]}
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
    </section>
  );
}
