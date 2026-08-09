import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Pagamento online via InfinitePay (Checkout Integrado).
 *
 * ⚠️ A API NÃO tem chave secreta — a única credencial é o `handle` (a
 * InfiniteTag da loja), que é público. Logo:
 *   * nada que chega pela URL de retorno ou pelo webhook pode ser acreditado;
 *   * toda confirmação passa por `payment_check` no servidor E confere se o
 *     valor pago cobre o total do pedido (senão alguém pagaria R$ 1 num pedido
 *     de R$ 600 usando um link próprio com o nosso order_nsu).
 */

const API = "https://api.checkout.infinitepay.io";

export function infinitepayHandle(): string | null {
  return process.env.INFINITEPAY_HANDLE?.trim() || null;
}

/** Reais -> centavos (a API cobra em centavos). */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

export type LinkItem = { quantity: number; price: number; description: string };

/** Cria o link de pagamento e devolve a URL para onde mandar o cliente. */
export async function createPaymentLink(params: {
  items: LinkItem[];
  orderNsu: string;
  redirectUrl: string;
  webhookUrl: string;
  customer?: { name?: string | null; email?: string | null; phone?: string | null };
}): Promise<{ ok: boolean; url?: string; error?: string; detail?: string }> {
  const handle = infinitepayHandle();
  if (!handle) return { ok: false, error: "Pagamento online indisponível." };

  const body: Record<string, unknown> = {
    handle,
    order_nsu: params.orderNsu,
    redirect_url: params.redirectUrl,
    webhook_url: params.webhookUrl,
    items: params.items,
  };
  if (params.customer?.name || params.customer?.email) {
    body.customer = {
      name: params.customer?.name ?? undefined,
      email: params.customer?.email ?? undefined,
      phone_number: params.customer?.phone ?? undefined,
    };
  }

  try {
    const res = await fetch(`${API}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();

    if (!res.ok) {
      // A InfinitePay devolve só {"success":false,"message":"Unable to create
      // checkout link"} — sem o motivo. Guardamos a resposta crua para o admin
      // enxergar (o cliente vê apenas a mensagem amigável).
      console.error("[infinitepay] links falhou", res.status, text);
      return {
        ok: false,
        error: "Erro ao gerar o pagamento.",
        detail: `HTTP ${res.status} — ${text.slice(0, 300)}`,
      };
    }

    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* resposta não-JSON cai na checagem abaixo */
    }
    // O nome do campo da URL não está claro na documentação: aceitamos as
    // variações conhecidas antes de desistir.
    const url =
      (data.url as string) ??
      (data.link as string) ??
      (data.payment_url as string) ??
      (data.checkout_url as string) ??
      ((data.data as Record<string, unknown> | undefined)?.url as string);

    if (!url) {
      console.error("[infinitepay] resposta sem URL", text);
      return {
        ok: false,
        error: "Erro ao gerar o pagamento.",
        detail: `Resposta sem link — ${text.slice(0, 300)}`,
      };
    }
    return { ok: true, url };
  } catch (err) {
    return {
      ok: false,
      error: "Não foi possível falar com o pagamento.",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export type PaymentCheck = {
  success?: boolean;
  paid?: boolean;
  amount?: number;
  paid_amount?: number;
  installments?: number;
  capture_method?: string;
};

/** Pergunta à InfinitePay se aquela transação foi mesmo paga. */
export async function paymentCheck(params: {
  orderNsu: string;
  transactionNsu: string;
  slug: string;
}): Promise<PaymentCheck | null> {
  const handle = infinitepayHandle();
  if (!handle) return null;
  try {
    const res = await fetch(`${API}/payment_check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle,
        order_nsu: params.orderNsu,
        transaction_nsu: params.transactionNsu,
        slug: params.slug,
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as PaymentCheck;
  } catch {
    return null;
  }
}

export type ConfirmResult = {
  paid: boolean;
  orderNumber?: number;
  reason?: string;
};

/**
 * Confirma um pagamento e, se legítimo, marca o pedido como pago e baixa o
 * estoque. Idempotente: a linha em `payments` tem unique(provider,provider_id),
 * então a segunda chamada (webhook + retorno do cliente chegam os dois) não
 * baixa o estoque de novo.
 */
export async function confirmPayment(params: {
  orderNsu: string;
  transactionNsu: string;
  slug: string;
}): Promise<ConfirmResult> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return { paid: false, reason: "config" };

  const check = await paymentCheck(params);
  if (!check?.paid) return { paid: false, reason: "nao_pago" };

  const admin = createAdminClient();
  const number = Number(params.orderNsu);
  if (!Number.isFinite(number)) return { paid: false, reason: "pedido" };

  const { data: order } = await admin
    .from("orders")
    .select("id, number, total, status")
    .eq("number", number)
    .maybeSingle();
  if (!order) return { paid: false, reason: "pedido" };

  // O valor pago precisa cobrir o pedido (tudo em centavos).
  const paidCents = Number(check.paid_amount ?? check.amount ?? 0);
  if (paidCents + 1 < toCents(Number(order.total)))
    return { paid: false, orderNumber: order.number, reason: "valor" };

  // Trava de idempotência: quem conseguir inserir é quem processa.
  const { error: payErr } = await admin.from("payments").insert({
    order_id: order.id,
    provider: "infinitepay",
    provider_id: params.transactionNsu,
    status: "approved",
    amount: paidCents / 100,
    raw: { ...check, slug: params.slug },
  });
  if (payErr) {
    // Já processado antes (unique provider+provider_id): nada a fazer.
    return { paid: true, orderNumber: order.number, reason: "ja_processado" };
  }

  await admin
    .from("orders")
    .update({
      status: "paid",
      payment_status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  await decreaseStock(order.id);
  return { paid: true, orderNumber: order.number };
}

/** Baixa do estoque as quantidades do pedido (depósito 'loja'). */
async function decreaseStock(orderId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: items } = await admin
    .from("order_items")
    .select("variant_id, qty")
    .eq("order_id", orderId);

  for (const it of items ?? []) {
    const { data: stock } = await admin
      .from("stock_cache")
      .select("id, qty_available")
      .eq("variant_id", it.variant_id)
      .eq("deposito_id", "loja")
      .maybeSingle();
    if (!stock) continue;
    await admin
      .from("stock_cache")
      .update({ qty_available: Math.max(0, stock.qty_available - it.qty) })
      .eq("id", stock.id);
  }
}
