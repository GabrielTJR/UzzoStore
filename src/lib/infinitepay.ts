import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderPaidEmail, sendNewOrderAdminEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

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

/**
 * A InfiniteTag aparece no app da InfinitePay COM o "$" na frente, e foi assim
 * que ela acabou na env da Vercel. A API rejeita o "$" com um 422 genérico
 * ("Unable to create checkout link") — exatamente o mesmo erro de handle
 * inexistente, sem dizer o motivo. O checkout ficou 5 dias fora por causa disso
 * (09 a 14/08/2026). Tirar o "$" aqui custa nada e mata a classe inteira.
 */
export function infinitepayHandle(): string | null {
  return process.env.INFINITEPAY_HANDLE?.trim().replace(/^\$+/, "") || null;
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
      // Também no audit_log: sem isto a falha só existe no log da Vercel, e a
      // loja fica sabendo que "deu erro" sem nenhum meio de descobrir por quê.
      await logAudit(null, {
        action: "payment.link_failed",
        entityType: "order",
        entityLabel: `nº ${params.orderNsu}`,
        metadata: {
          status: res.status,
          resposta: text.slice(0, 500),
          handle,
          total_centavos: params.items.reduce(
            (s, i) => s + i.price * i.quantity,
            0,
          ),
        },
      });
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
      await logAudit(null, {
        action: "payment.link_failed",
        entityType: "order",
        entityLabel: `nº ${params.orderNsu}`,
        metadata: { motivo: "resposta sem URL", resposta: text.slice(0, 500), handle },
      });
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

  await decreaseStock(order.id, order.number);
  await notifyPaid(order.id, order.number);
  return { paid: true, orderNumber: order.number };
}

/** Manda ao cliente a confirmação do pagamento (nunca bloqueia a compra). */
async function notifyPaid(orderId: string, orderNumber: number): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select(
        "customer_id, total, shipping_method, shipping_address, order_items ( product_name, variant_label, unit_price, qty )",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (!order?.customer_id) return;

    const [{ data: profile }, { data: authUser }] = await Promise.all([
      admin
        .from("customers")
        .select("full_name, phone")
        .eq("id", order.customer_id)
        .maybeSingle(),
      admin.auth.admin.getUserById(order.customer_id),
    ]);
    const to = authUser?.user?.email;
    if (!to) return;

    const items = (
      (order as unknown as {
        order_items: {
          product_name: string;
          variant_label: string | null;
          unit_price: number;
          qty: number;
        }[];
      }).order_items ?? []
    ).map((i) => ({
      productName: i.product_name,
      variantLabel: i.variant_label,
      unitPrice: Number(i.unit_price),
      qty: i.qty,
    }));

    await sendOrderPaidEmail({
      to,
      customerName: profile?.full_name ?? null,
      orderNumber,
      total: Number(order.total),
      items,
      pickup: order.shipping_method === "pickup",
    });

    // A loja também precisa saber que entrou venda.
    const addr = order.shipping_address as {
      street?: string;
      number?: string | null;
      city?: string;
      state?: string;
    } | null;
    await sendNewOrderAdminEmail({
      orderNumber,
      total: Number(order.total),
      items,
      customerName: profile?.full_name ?? null,
      customerPhone: profile?.phone ?? null,
      channel: "online",
      shipping: (order.shipping_method as "pickup" | "delivery" | null) ?? null,
      addressLine: addr
        ? `${addr.street ?? ""}${addr.number ? `, ${addr.number}` : ""} — ${addr.city ?? ""}/${addr.state ?? ""}`
        : null,
    });
  } catch (err) {
    console.error("[infinitepay] falha ao avisar pagamento", err);
  }
}

/**
 * Baixa do estoque as quantidades do pedido (depósito 'loja').
 *
 * Usa a função `decrement_stock` (migração 0012), que faz a conta dentro do
 * UPDATE: dois pagamentos simultâneos não conseguem levar a mesma peça.
 * Se faltar saldo, o pagamento JÁ ACONTECEU — não dá para recusar. Então
 * registramos em /admin/logs para a loja resolver com o cliente.
 */
async function decreaseStock(orderId: string, orderNumber: number): Promise<void> {
  const admin = createAdminClient();
  const { data: items } = await admin
    .from("order_items")
    .select("variant_id, qty, product_name, variant_label")
    .eq("order_id", orderId);

  const semSaldo: string[] = [];
  for (const it of items ?? []) {
    const { data: restante, error } = await admin.rpc("decrement_stock", {
      p_variant_id: it.variant_id,
      p_qty: it.qty,
    });
    if (error || restante === -1 || restante === null) {
      semSaldo.push(
        [it.product_name, it.variant_label].filter(Boolean).join(" — "),
      );
    }
  }

  if (semSaldo.length > 0) {
    await logAudit(null, {
      action: "stock.shortage",
      entityType: "order",
      entityId: orderId,
      entityLabel: `Pedido nº ${orderNumber}`,
      metadata: {
        itens: semSaldo,
        aviso:
          "Pagamento confirmado sem saldo em estoque — conferir com o cliente.",
      },
    });
  }
}
