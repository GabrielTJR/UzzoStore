/**
 * Eventos do funil de vendas para o Google Analytics — módulo NEUTRO (só roda
 * no navegador; no servidor não faz nada).
 *
 * ⚠️ RESPEITA O AVISO DE COOKIES SEM CHECAGEM PRÓPRIA: a função `gtag` só existe
 * na página depois do "Aceitar" (quem a cria é o `CookieConsent`). Sem aceite,
 * `track` não encontra nada e não envia nada. Não crie aqui um `dataLayer` ou um
 * `gtag` de reserva — isso enfileiraria eventos para quem RECUSOU e eles seriam
 * enviados se o script entrasse depois por qualquer outro caminho.
 *
 * Os nomes são os eventos de e-commerce recomendados do GA4 (view_item,
 * add_to_cart, begin_checkout, add_payment_info, purchase): é com eles que o
 * próprio Google monta os relatórios de compra, e é por eles que o card de funil
 * do painel conta as etapas (`lib/analytics.ts`).
 */

export type TrackItem = {
  item_id: string;
  item_name: string;
  price?: number;
  quantity?: number;
  item_variant?: string;
};

type Gtag = (...args: unknown[]) => void;

export function track(
  event:
    | "view_item"
    | "add_to_cart"
    | "begin_checkout"
    | "add_payment_info"
    | "purchase"
    | "checkout_whatsapp",
  params: {
    value?: number;
    items?: TrackItem[];
    transaction_id?: string;
    shipping?: number;
    coupon?: string;
  } = {},
): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag !== "function") return;
  try {
    gtag("event", event, { currency: "BRL", ...params });
  } catch {
    // Medição nunca pode atrapalhar a compra.
  }
}

/** Itens da sacola no formato do GA. */
export function cartItemsForTrack(
  items: {
    variantId: string;
    productName: string;
    price: number;
    qty: number;
    color?: string | null;
    size?: string | null;
  }[],
): TrackItem[] {
  return items.map((i) => ({
    item_id: i.variantId,
    item_name: i.productName,
    price: i.price,
    quantity: i.qty,
    item_variant: [i.color, i.size].filter(Boolean).join(" / ") || undefined,
  }));
}
