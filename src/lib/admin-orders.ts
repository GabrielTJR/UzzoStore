import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Situações do pedido (o schema aceita estes valores em `orders.status`). */
export const ORDER_STATUS = {
  pending: "Aguardando",
  paid: "Pago",
  shipped: "Enviado",
  canceled: "Cancelado",
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS;

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && v in ORDER_STATUS;
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
