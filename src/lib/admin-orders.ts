import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Situações do pedido. `orders.status` é texto livre no banco, então a
 * verdade do fluxo está aqui.
 *
 * O caminho depende da forma de entrega:
 *   retirada: aguardando → pago → pronto para retirada → concluído
 *   entrega:  aguardando → pago → enviado            → concluído
 * `cancelado` é possível enquanto não estiver concluído.
 */
export const ORDER_STATUS = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  ready: "Pronto para retirada",
  shipped: "Enviado",
  delivered: "Concluído",
  canceled: "Cancelado",
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS;

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && v in ORDER_STATUS;
}

/** Etapas visíveis do pedido, na ordem, conforme retirada ou entrega. */
export function orderSteps(shippingMethod: string | null): OrderStatus[] {
  const middle: OrderStatus = shippingMethod === "pickup" ? "ready" : "shipped";
  return ["pending", "paid", middle, "delivered"];
}

/** Próxima etapa natural (null quando terminou ou foi cancelado). */
export function nextOrderStatus(
  status: string,
  shippingMethod: string | null,
): OrderStatus | null {
  if (status === "canceled" || status === "delivered") return null;
  const steps = orderSteps(shippingMethod);
  const i = steps.indexOf(status as OrderStatus);
  if (i === -1) return "paid"; // situação antiga/desconhecida: segue para paga
  return steps[i + 1] ?? null;
}

/** Rótulo do botão que avança o pedido. */
export function nextStatusLabel(next: OrderStatus): string {
  return {
    pending: "Voltar para aguardando",
    paid: "Marcar como pago",
    ready: "Marcar como pronto p/ retirada",
    shipped: "Marcar como enviado",
    delivered: "Marcar como concluído",
    canceled: "Cancelar",
  }[next];
}

export type AdminOrderItem = {
  productName: string;
  variantLabel: string | null;
  unitPrice: number;
  qty: number;
};

export type AdminOrder = {
  id: string;
  number: number;
  status: string;
  channel: string;
  total: number;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  customerCpf: string | null;
  shippingMethod: string | null;
  shippingAddress: {
    label?: string | null;
    cep?: string;
    street?: string;
    number?: string | null;
    complement?: string | null;
    district?: string | null;
    city?: string;
    state?: string;
  } | null;
  items: AdminOrderItem[];
};

type Row = {
  id: string;
  number: number;
  status: string;
  channel: string;
  total: number;
  created_at: string;
  shipping_method: string | null;
  shipping_address: AdminOrder["shippingAddress"];
  customers: { full_name: string | null; phone: string | null; cpf: string | null } | null;
  order_items: {
    product_name: string;
    variant_label: string | null;
    unit_price: number;
    qty: number;
  }[];
};

/** Pedidos para o admin (service_role: enxerga de todos os clientes). */
export async function getAdminOrders(limit = 100): Promise<AdminOrder[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select(
      `id, number, status, channel, total, created_at, shipping_method, shipping_address,
       customers ( full_name, phone, cpf ),
       order_items ( product_name, variant_label, unit_price, qty )`,
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  return (data as unknown as Row[]).map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    channel: o.channel,
    total: Number(o.total),
    createdAt: o.created_at,
    customerName: o.customers?.full_name ?? null,
    customerPhone: o.customers?.phone ?? null,
    customerCpf: o.customers?.cpf ?? null,
    shippingMethod: o.shipping_method,
    shippingAddress: o.shipping_address,
    items: (o.order_items ?? []).map((i) => ({
      productName: i.product_name,
      variantLabel: i.variant_label,
      unitPrice: Number(i.unit_price),
      qty: i.qty,
    })),
  }));
}
