import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/customer";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";
import { linkRastreio } from "@/lib/shipping-config";
import {
  PAYMENT_STATUS,
  FULFILLMENT_STATUS,
  fulfillmentSteps,
  situacaoCliente,
} from "@/lib/admin-orders";
import { CancelOrderButton } from "../cancel-order-button";

export const metadata: Metadata = { title: "Detalhes do pedido" };

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
  payment_status: string;
  fulfillment_status: string;
  channel: string;
  shipping_method: string | null;
  shipping_address: Address | null;
  shipping_service: string | null;
  shipping_cost: number | null;
  coupon_code: string | null;
  discount: number | null;
  tracking_code: string | null;
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
      `id, number, payment_status, fulfillment_status, channel, shipping_method,
       shipping_address, subtotal, shipping_total, total, created_at,
       shipping_service, shipping_cost, coupon_code, discount, tracking_code,
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
          {situacaoCliente(o.payment_status, o.fulfillment_status)}
        </p>
      </div>

      {/* Andamento do pedido — o caminho muda entre retirada e entrega. */}
      {o.fulfillment_status !== "canceled" && (
        <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border p-5 text-sm">
          {fulfillmentSteps(o.shipping_method).map((s, i, arr) => {
            const reached =
              arr.indexOf(o.fulfillment_status as (typeof arr)[number]) >= i;
            const current = o.fulfillment_status === s;
            return (
              <li key={s} className="flex items-center gap-3">
                <span
                  className={
                    current
                      ? "font-medium"
                      : reached
                        ? "text-green-700 dark:text-green-400"
                        : "text-muted"
                  }
                >
                  {reached && !current ? "✓ " : ""}
                  {FULFILLMENT_STATUS[s]}
                </span>
                {i < arr.length - 1 && <span className="text-muted">→</span>}
              </li>
            );
          })}
        </ol>
      )}

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
          {Number(o.discount ?? 0) > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Cupom {o.coupon_code}</dt>
              <dd>−{formatBRL(Number(o.discount))}</dd>
            </div>
          )}
          {(o.shipping_method === "delivery" ||
            o.shipping_service != null ||
            Number(o.shipping_cost ?? 0) > 0) && (
            <div className="flex justify-between">
              <dt className="text-muted">
                Frete{o.shipping_service ? ` (${o.shipping_service})` : ""}
              </dt>
              <dd>
                {Number(o.shipping_cost ?? 0) > 0
                  ? formatBRL(Number(o.shipping_cost))
                  : o.shipping_service
                    ? "grátis"
                    : "a combinar"}
              </dd>
            </div>
          )}
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
        {o.tracking_code &&
          (() => {
            // O destino depende da transportadora, não só do formato do código:
            // a maioria dos envios para fora da região não vai de Correios.
            const { url, transportadora } = linkRastreio(
              o.tracking_code,
              o.shipping_service,
            );
            return (
              <p className="mb-3 rounded-md border border-border px-3 py-2">
                📦 Rastreio:{" "}
                {url ? (
                  <>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono font-medium underline underline-offset-4"
                    >
                      {o.tracking_code}
                    </a>
                    {transportadora && (
                      <span className="text-muted"> · {transportadora}</span>
                    )}
                  </>
                ) : (
                  <span className="font-mono font-medium">
                    {o.tracking_code}
                    <span className="font-sans font-normal text-muted">
                      {transportadora
                        ? ` — acompanhe no site da ${transportadora}`
                        : " — acompanhe no site da transportadora"}
                    </span>
                  </span>
                )}
              </p>
            );
          })()}
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
          <p className="text-muted">Combinado pelo WhatsApp com a loja.</p>
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
          Situação: {PAYMENT_STATUS[
            o.payment_status as keyof typeof PAYMENT_STATUS
          ] ?? o.payment_status}.
        </p>
      </div>

      {o.payment_status === "pending" &&
        o.fulfillment_status !== "canceled" && (
        <CancelOrderButton orderId={o.id} number={o.number} />
      )}
    </section>
  );
}
