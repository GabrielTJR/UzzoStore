import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * O pedido anda em DOIS EIXOS INDEPENDENTES: pagamento e atendimento.
 *
 * Misturar os dois numa trilha linear só foi o que produziu, em produção,
 * pedidos "pagos" sem dinheiro nenhum ter entrado (nº 1007 e 1008): o botão de
 * avançar empurrava o pedido inteiro e o `payment_status` ficava para trás.
 * Agora cada eixo tem domínio fechado no banco (migração 0016) e regra própria
 * de quem pode escrever — a contradição fica impossível por construção, não por
 * disciplina de quem clica.
 */

/** Eixo do dinheiro. */
export const PAYMENT_STATUS = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  expired: "Expirado",
  refunded: "Estornado",
  canceled: "Cancelado",
} as const;

export type PaymentStatus = keyof typeof PAYMENT_STATUS;

export function isPaymentStatus(v: unknown): v is PaymentStatus {
  return typeof v === "string" && v in PAYMENT_STATUS;
}

/** Eixo do trabalho físico da loja. */
export const FULFILLMENT_STATUS = {
  pending: "Aguardando",
  preparing: "Separando",
  ready: "Pronto para retirada",
  shipped: "Enviado",
  done: "Concluído",
  canceled: "Cancelado",
} as const;

export type FulfillmentStatus = keyof typeof FULFILLMENT_STATUS;

export function isFulfillmentStatus(v: unknown): v is FulfillmentStatus {
  return typeof v === "string" && v in FULFILLMENT_STATUS;
}

/** Etapas do atendimento, conforme retirada ou entrega. */
export function fulfillmentSteps(
  shippingMethod: string | null,
): FulfillmentStatus[] {
  const middle: FulfillmentStatus =
    shippingMethod === "pickup" ? "ready" : "shipped";
  return ["pending", "preparing", middle, "done"];
}

/** Próxima etapa natural do atendimento (null quando terminou/cancelou). */
export function nextFulfillmentStatus(
  current: string,
  shippingMethod: string | null,
): FulfillmentStatus | null {
  if (current === "canceled" || current === "done") return null;
  const steps = fulfillmentSteps(shippingMethod);
  const i = steps.indexOf(current as FulfillmentStatus);
  if (i === -1) return "preparing";
  return steps[i + 1] ?? null;
}

/** Rótulo do botão que avança o atendimento. */
export function fulfillmentLabel(next: FulfillmentStatus): string {
  return {
    pending: "Voltar para aguardando",
    preparing: "Marcar como separando",
    ready: "Marcar como pronto p/ retirada",
    shipped: "Marcar como enviado",
    done: "Marcar como concluído",
    canceled: "Cancelar",
  }[next];
}

/**
 * O eixo físico só anda com o dinheiro dentro. É ESTA trava que impede o estado
 * impossível de antes — separar peça de pedido não pago é prejuízo esperando
 * acontecer.
 */
export function podeAvancarAtendimento(paymentStatus: string): boolean {
  return paymentStatus === "paid";
}

/**
 * Marcar pagamento na mão só faz sentido no WhatsApp, onde o dinheiro entra
 * fora do sistema (PIX na maquininha, transferência, dinheiro vivo). No online
 * quem decide é o `confirmPayment`, com `payment_check` e conferência de valor:
 * um botão manual ali seria uma porta para marcar como pago o que não foi.
 */
export function aceitaPagamentoManual(channel: string): boolean {
  return channel === "whatsapp";
}

/**
 * O cliente não quer dois eixos — quer saber onde está o pedido dele. Colapsa
 * os dois numa frase só: o pagamento manda enquanto não entrou, o atendimento
 * manda depois.
 */
export function situacaoCliente(
  paymentStatus: string,
  fulfillmentStatus: string,
): string {
  if (fulfillmentStatus === "canceled" || paymentStatus === "canceled")
    return "Cancelado";
  if (paymentStatus === "expired") return "Expirado por falta de pagamento";
  if (paymentStatus === "refunded") return "Estornado";
  if (paymentStatus !== "paid") return "Aguardando pagamento";
  return (
    {
      pending: "Pagamento confirmado",
      preparing: "Separando seu pedido",
      ready: "Pronto para retirada",
      shipped: "Enviado",
      done: "Concluído",
      canceled: "Cancelado",
    }[fulfillmentStatus as FulfillmentStatus] ?? "Pagamento confirmado"
  );
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
  paymentStatus: string;
  fulfillmentStatus: string;
  expiresAt: string | null;
  channel: string;
  total: number;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  customerCpf: string | null;
  shippingMethod: string | null;
  shippingService: string | null;
  shippingCost: number;
  couponCode: string | null;
  discount: number;
  trackingCode: string | null;
  isNew: boolean;
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
  payment_status: string;
  fulfillment_status: string;
  expires_at: string | null;
  channel: string;
  total: number;
  created_at: string;
  shipping_method: string | null;
  shipping_service: string | null;
  shipping_cost: number | null;
  coupon_code: string | null;
  discount: number | null;
  tracking_code: string | null;
  seen_at: string | null;
  shipping_address: AdminOrder["shippingAddress"];
  customers: {
    full_name: string | null;
    phone: string | null;
    cpf: string | null;
  } | null;
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
      `id, number, payment_status, fulfillment_status, expires_at, channel, total, created_at,
       shipping_method, seen_at, shipping_address,
       shipping_service, shipping_cost, coupon_code, discount, tracking_code,
       customers ( full_name, phone, cpf ),
       order_items ( product_name, variant_label, unit_price, qty )`,
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  return (data as unknown as Row[]).map((o) => ({
    id: o.id,
    number: o.number,
    paymentStatus: o.payment_status,
    fulfillmentStatus: o.fulfillment_status,
    expiresAt: o.expires_at,
    channel: o.channel,
    total: Number(o.total),
    createdAt: o.created_at,
    customerName: o.customers?.full_name ?? null,
    customerPhone: o.customers?.phone ?? null,
    customerCpf: o.customers?.cpf ?? null,
    shippingMethod: o.shipping_method,
    shippingService: o.shipping_service ?? null,
    shippingCost: Number(o.shipping_cost ?? 0),
    couponCode: o.coupon_code ?? null,
    discount: Number(o.discount ?? 0),
    trackingCode: o.tracking_code ?? null,
    isNew: o.seen_at === null,
    shippingAddress: o.shipping_address,
    items: (o.order_items ?? []).map((i) => ({
      productName: i.product_name,
      variantLabel: i.variant_label,
      unitPrice: Number(i.unit_price),
      qty: i.qty,
    })),
  }));
}

/** Quantos pedidos a loja ainda não viu (badge no menu do admin). */
export async function countNewOrders(): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .is("seen_at", null);
  return count ?? 0;
}

/**
 * Colunas do quadro, na ordem em que o trabalho anda de verdade na loja.
 *
 * A primeira coluna é de pagamento e as outras são de atendimento: juntas
 * formam a fila real de quem opera. Sem "aguardando pagamento" no quadro, o
 * pedido que ainda não pode ser separado sumiria da vista — e é justamente o
 * que a loja precisa vigiar para cobrar ou deixar expirar.
 */
export const KANBAN_COLUNAS = [
  { key: "aguardando_pagamento", label: "Aguardando pagamento" },
  { key: "a_separar", label: "A separar" },
  { key: "preparing", label: "Separando" },
  { key: "ready", label: "Pronto p/ retirada" },
  { key: "shipped", label: "Enviado" },
  { key: "done", label: "Concluído" },
] as const;

export type KanbanColuna = (typeof KANBAN_COLUNAS)[number]["key"];

/**
 * Em que coluna o pedido aparece. `null` = fora do quadro (cancelado ou
 * expirado): pedido morto na fila de trabalho vira ruído, e quem procura por
 * ele usa a lista.
 */
export function colunaKanban(
  paymentStatus: string,
  fulfillmentStatus: string,
): KanbanColuna | null {
  if (
    fulfillmentStatus === "canceled" ||
    paymentStatus === "canceled" ||
    paymentStatus === "expired" ||
    paymentStatus === "refunded"
  )
    return null;
  if (paymentStatus !== "paid") return "aguardando_pagamento";
  if (fulfillmentStatus === "pending") return "a_separar";
  return fulfillmentStatus as KanbanColuna;
}
