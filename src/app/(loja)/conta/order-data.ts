import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Leitura dos pedidos do CLIENTE para a área da conta (resumo, lista e
 * detalhe) — um lugar só para o select e a conversão.
 *
 * Sempre o client com COOKIE: o RLS (`own_orders_select`) é quem isola um
 * cliente do outro, e o filtro por `customer_id` é defesa em profundidade.
 * Nada aqui pode ir para `unstable_cache`: é dado de sessão.
 *
 * A foto de cada peça vem pelo caminho variante → cor → `gallery->>0` (só a
 * PRIMEIRA URL, não o array inteiro). `order_items` não guarda foto, e as
 * tabelas de catálogo têm leitura pública, então o embed funciona sem
 * service_role. O slug passa por `products`, cujo RLS esconde peça inativa:
 * aí o item só perde o link, o pedido continua inteiro.
 */

export type OrderAddress = {
  label?: string | null;
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};

export type AccountOrderItem = {
  product_name: string;
  variant_label: string | null;
  unit_price: number;
  qty: number;
  image: string | null;
  slug: string | null;
};

/** Campos em snake_case de propósito: `podePagarAgora` e o botão de pagar
 * leem o pedido nesse formato. */
export type AccountOrder = {
  id: string;
  number: number;
  payment_status: string;
  fulfillment_status: string;
  channel: string;
  shipping_method: string | null;
  shipping_address: OrderAddress | null;
  shipping_service: string | null;
  shipping_cost: number;
  coupon_code: string | null;
  discount: number;
  tracking_code: string | null;
  subtotal: number;
  total: number;
  created_at: string;
  expires_at: string | null;
  items: AccountOrderItem[];
};

const ITEMS = `order_items ( product_name, variant_label, unit_price, qty, created_at,
  product_variants ( product_colors ( foto:gallery->>0 ), products ( product_content ( slug ) ) ) )`;

/** A lista só precisa do cabeçalho do pedido + as peças (foto e nome). */
const LIST_SELECT = `id, number, payment_status, fulfillment_status, channel,
  shipping_method, total, created_at, expires_at, ${ITEMS}`;

const DETAIL_SELECT = `id, number, payment_status, fulfillment_status, channel,
  shipping_method, shipping_address, shipping_service, shipping_cost,
  coupon_code, discount, tracking_code, subtotal, total, created_at,
  expires_at, ${ITEMS}`;

type One<T> = T | T[] | null | undefined;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

type RawItem = {
  product_name: string;
  variant_label: string | null;
  unit_price: number | string;
  qty: number;
  created_at?: string;
  product_variants: One<{
    product_colors: One<{ foto: string | null }>;
    products: One<{ product_content: One<{ slug: string }> }>;
  }>;
};

type RawOrder = Record<string, unknown> & { order_items?: RawItem[] };

function toOrder(r: RawOrder): AccountOrder {
  const items = [...(r.order_items ?? [])]
    // Ordem em que entraram no pedido: a "1ª peça" do cartão é estável.
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))
    .map((it): AccountOrderItem => {
      const v = one(it.product_variants);
      return {
        product_name: it.product_name,
        variant_label: it.variant_label,
        unit_price: Number(it.unit_price),
        qty: it.qty,
        image: one(v?.product_colors)?.foto ?? null,
        slug: one(one(v?.products)?.product_content)?.slug ?? null,
      };
    });
  return {
    id: String(r.id),
    number: Number(r.number),
    payment_status: String(r.payment_status),
    fulfillment_status: String(r.fulfillment_status),
    channel: String(r.channel),
    shipping_method: (r.shipping_method as string | null) ?? null,
    shipping_address: (r.shipping_address as OrderAddress | null) ?? null,
    shipping_service: (r.shipping_service as string | null) ?? null,
    shipping_cost: Number(r.shipping_cost ?? 0),
    coupon_code: (r.coupon_code as string | null) ?? null,
    discount: Number(r.discount ?? 0),
    tracking_code: (r.tracking_code as string | null) ?? null,
    subtotal: Number(r.subtotal ?? 0),
    total: Number(r.total ?? 0),
    created_at: String(r.created_at),
    expires_at: (r.expires_at as string | null) ?? null,
    items,
  };
}

/** Pedidos do cliente, mais novos primeiro (`limit` para o resumo). */
export async function getCustomerOrders(
  customerId: string,
  limit?: number,
): Promise<AccountOrder[]> {
  const supabase = await createClient();
  let q = supabase
    .from("orders")
    .select(LIST_SELECT)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (limit) q = q.limit(limit);
  const { data } = await q;
  return ((data ?? []) as unknown as RawOrder[]).map(toOrder);
}

/** Um pedido do cliente (null se não existe ou não é dele). */
export async function getCustomerOrder(
  customerId: string,
  id: string,
): Promise<AccountOrder | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .eq("customer_id", customerId)
    .maybeSingle();
  return data ? toOrder(data as unknown as RawOrder) : null;
}
