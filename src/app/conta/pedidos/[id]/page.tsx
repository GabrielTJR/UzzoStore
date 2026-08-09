import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/customer";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";
import { CancelOrderButton } from "../cancel-order-button";

export const metadata: Metadata = { title: "Detalhes do pedido" };

const STATUS: Record<string, string> = {
  pending: "Aguardando confirmação",
  paid: "Pago",
  shipped: "Enviado",
  canceled: "Cancelado",
  failed: "Não concluído",
};

type Address = {
  label?: string | null;
  cep?: string;
  street?: string;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string;
  state?: string;
};

type OrderRow = {
  id: string;
  number: number;
  status: string;
  payment_status: string;
  channel: string;
  shipping_method: string | null;
  shipping_address: Address | null;
  subtotal: number;
  shipping_total: number;
  total: number;
  created_at: string;
  order_items: {
    product_name: string;
    variant_label: string | null;
    unit_price: number;
    qty: number;
  }[];
};

export default async function PedidoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireCustomer("/conta/pedidos");
  const { id } = await params;

  const supabase = await createClient();
  // RLS (own_orders_select) já limita ao dono; o filtro por customer_id é
  // defesa em profundidade.
  const { data } = await supabase
    .from("orders")
    .select(
      `id, number, status, payment_status, channel, shipping_method,
       shipping_address, subtotal, shipping_total, total, created_at,
       order_items ( product_name, variant_label, unit_price, qty )`,
    )
    .eq("id", id)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (!data) notFound();
  const o = data as unknown as OrderRow;
  const addr = o.shipping_address;

  return (
    <section className="mx-auto max-w-2xl space-y-8 px-6 py-12">
      <div>
        <Link
          href="/conta/pedidos"
          className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Meus pedidos
        </Link>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">
          Pedido nº {o.number}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {new Date(o.created_at).toLocaleString("pt-BR")} ·{" "}
          {STATUS[o.status] ?? o.status}
        </p>
      </div>

      <div className="rounded-lg border border-border p-5">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.15em] text-muted">
          Itens
        </h2>
        <ul className="space-y-2 text-sm">
          {o.order_items.map((i, k) => (
            <li key={k} className="flex justify-between gap-4">
              <span>
                {i.qty}× {i.product_name}
                {i.variant_label && (
                  <span className="block text-muted">{i.variant_label}</span>
                )}
              </span>
              <span className="shrink-0 text-muted">
                {formatBRL(Number(i.unit_price) * i.qty)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd>{formatBRL(Number(o.subtotal))}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Frete</dt>
            <dd>
              {Number(o.shipping_total) > 0
                ? formatBRL(Number(o.shipping_total))
                : "a combinar"}
            </dd>
          </div>
          <div className="flex justify-between font-medium">
            <dt>Total pago</dt>
            <dd>{formatBRL(Number(o.total))}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border p-5 text-sm">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.15em] text-muted">
          Entrega
        </h2>
        {o.shipping_method === "pickup" && (
          <p>
            <span className="font-medium">Retirada na loja</span>
            <span className="block text-muted">
              Rua 3650, nº 3573 — Sala 2, Balneário Camboriú/SC
            </span>
          </p>
        )}
        {o.shipping_method === "delivery" && addr && (
          <p>
            <span className="font-medium">
              Entrega{addr.label ? ` — ${addr.label}` : ""}
            </span>
            <span className="block text-muted">
              {addr.street}
              {addr.number ? `, ${addr.number}` : ""}
              {addr.complement ? ` — ${addr.complement}` : ""}
            </span>
            <span className="block text-muted">
              {addr.district ? `${addr.district}, ` : ""}
              {addr.city}/{addr.state} · CEP {addr.cep}
            </span>
          </p>
        )}
        {!o.shipping_method && (
          <p className="text-muted">
            Combinado pelo WhatsApp com a loja.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border p-5 text-sm">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.15em] text-muted">
          Pagamento
        </h2>
        <p className="text-muted">
          {o.channel === "online"
            ? "Pago pelo site (Pix ou cartão)."
            : "Combinado pelo WhatsApp."}{" "}
          Situação: {STATUS[o.status] ?? o.status}.
        </p>
      </div>

      {o.status === "pending" && (
        <CancelOrderButton orderId={o.id} number={o.number} />
      )}
    </section>
  );
}
