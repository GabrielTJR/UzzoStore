import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getAdminOrders, ORDER_STATUS } from "@/lib/admin-orders";
import { formatBRL } from "@/lib/format";
import { updateOrderStatusAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = { title: "Pedidos" };

const STATUS_STYLE: Record<string, string> = {
  pending: "border-amber-500 text-amber-700 dark:text-amber-400",
  paid: "border-green-600 text-green-700 dark:text-green-400",
  shipped: "border-blue-500 text-blue-700 dark:text-blue-400",
  canceled: "border-border text-muted line-through",
};

export default async function PedidosAdminPage() {
  await requireAdmin();
  const orders = await getAdminOrders();

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

      <div className="mt-8 space-y-4">
        {orders.map((o) => (
          <div key={o.id} className="rounded-lg border border-border p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="font-medium">
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

            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              {(
                Object.keys(ORDER_STATUS) as (keyof typeof ORDER_STATUS)[]
              ).map((s) => (
                <form key={s} action={updateOrderStatusAction}>
                  <input type="hidden" name="orderId" value={o.id} />
                  <input type="hidden" name="status" value={s} />
                  <SubmitButton
                    disabled={o.status === s}
                    pendingText="…"
                    className={`h-8 rounded-full border px-4 text-xs font-medium transition-colors ${
                      o.status === s
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    {ORDER_STATUS[s]}
                  </SubmitButton>
                </form>
              ))}
            </div>
          </div>
        ))}

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
