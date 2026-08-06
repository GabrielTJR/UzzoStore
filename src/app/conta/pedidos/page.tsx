import Link from "next/link";
import type { Metadata } from "next";
import { requireCustomer } from "@/lib/customer";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";

export const metadata: Metadata = { title: "Meus pedidos" };

const tab =
  "rounded-full border border-border px-4 py-1.5 text-sm text-muted transition-colors hover:border-foreground hover:text-foreground";

const STATUS: Record<string, string> = {
  pending: "Aguardando confirmação",
  paid: "Pago",
  shipped: "Enviado",
  canceled: "Cancelado",
  failed: "Não concluído",
};

type OrderRow = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  order_items: {
    product_name: string;
    variant_label: string | null;
    unit_price: number;
    qty: number;
  }[];
};

export default async function PedidosPage() {
  const user = await requireCustomer("/conta/pedidos");
  const supabase = await createClient();
  // RLS: o cliente só enxerga os próprios pedidos (policy own_orders_select).
  const { data } = await supabase
    .from("orders")
    .select(
      "id, status, total, created_at, order_items ( product_name, variant_label, unit_price, qty )",
    )
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  const orders = (data ?? []) as unknown as OrderRow[];

  return (
    <section className="mx-auto max-w-3xl space-y-8 px-6 py-12">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Meus pedidos
        </h1>
        <p className="mt-1 text-sm text-muted">
          Acompanhe aqui as compras feitas pelo site.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        <Link href="/conta" className={tab}>
          Dados
        </Link>
        <Link href="/conta/enderecos" className={tab}>
          Endereços
        </Link>
        <span className="rounded-full border border-foreground bg-foreground px-4 py-1.5 text-sm font-medium text-background">
          Pedidos
        </span>
      </nav>

      <div className="space-y-4">
        {orders.map((o) => (
          <div key={o.id} className="rounded-lg border border-border p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">
                Pedido de{" "}
                {new Date(o.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <span className="text-xs text-muted">
                {STATUS[o.status] ?? o.status}
              </span>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {o.order_items.map((it, i) => (
                <li key={i}>
                  {it.qty}× {it.product_name}
                  {it.variant_label ? ` — ${it.variant_label}` : ""} ·{" "}
                  {formatBRL(Number(it.unit_price) * it.qty)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm font-medium">
              Total: {formatBRL(Number(o.total))}
            </p>
          </div>
        ))}

        {orders.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted">
            <p>Você ainda não tem pedidos por aqui.</p>
            <Link
              href="/produtos"
              className="mt-2 inline-block underline underline-offset-4 hover:text-foreground"
            >
              Ver produtos
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
