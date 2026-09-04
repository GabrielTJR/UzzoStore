import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderPaidEmail, sendNewOrderAdminEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { consumirReserva, baixarEstoque, itensDoPedido } from "@/lib/stock";
import { consumeCoupon } from "@/lib/coupons";

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

/**
 * Endereço de entrega repassado ao checkout deles. Os nomes são os da API da
 * InfinitePay: o `neighborhood` é o que chamamos de `district` (bairro), e não
 * existe campo de cidade/estado — eles derivam do CEP.
 */
export type LinkAddress = {
  cep: string;
  street?: string | null;
  neighborhood?: string | null;
  number?: string | null;
  complement?: string | null;
};

/** Cria o link de pagamento e devolve a URL para onde mandar o cliente. */
export async function createPaymentLink(params: {
  items: LinkItem[];
  orderNsu: string;
  redirectUrl: string;
  webhookUrl: string;
  customer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  /**
   * Só na ENTREGA (na retirada não há endereço). Mandar isto poupa o cliente de
   * redigitar, no passo "Entrega" do checkout deles, um endereço que ele já deu
   * para a loja cotar o frete — atrito no ponto de maior desistência.
   */
  address?: LinkAddress | null;
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
  // Sem CEP não há o que pré-preencher, e mandar objeto pela metade só arrisca
  // uma recusa da API — que aqui responde 422 genérico e derruba o checkout.
  if (params.address?.cep) {
    body.address = {
      cep: params.address.cep,
      street: params.address.street ?? undefined,
      neighborhood: params.address.neighborhood ?? undefined,
      number: params.address.number ?? undefined,
      complement: params.address.complement ?? undefined,
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
        metadata: {
          motivo: "resposta sem URL",
          resposta: text.slice(0, 500),
          handle,
        },
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
    .select("id, number, total, payment_status, coupon_code")
    .eq("number", number)
    .maybeSingle();
  if (!order) return { paid: false, reason: "pedido" };

  // Estornado NÃO volta a ser pago por uma confirmação atrasada: o dinheiro já
  // saiu de volta, e remarcar como pago recolocaria o pedido na fila de
  // faturamento com o caixa a menos.
  if (order.payment_status === "refunded") {
    await logAudit(null, {
      action: "payment.pos_estorno",
      entityType: "order",
      entityId: order.id,
      entityLabel: `nº ${order.number}`,
      metadata: { transacao: params.transactionNsu },
    });
    return { paid: false, orderNumber: order.number, reason: "estornado" };
  }

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
    // Só a violação do unique (provider+provider_id) significa "já processado".
    // Qualquer outro erro — timeout, indisponibilidade — NÃO pode responder
    // "pago": o webhook receberia 200, a InfinitePay nunca reenviaria, e o
    // pedido ficaria parado com o dinheiro dentro. E, pior, este return também
    // pula a separação de peça logo abaixo.
    if (payErr.code !== "23505") {
      console.error("[infinitepay] falha ao gravar o pagamento", payErr);
      return { paid: false, orderNumber: order.number, reason: "erro" };
    }
    return { paid: true, orderNumber: order.number, reason: "ja_processado" };
  }

  // ⚠️ O pedido pode ter EXPIRADO antes de o dinheiro chegar. O link da
  // InfinitePay não expira junto com a nossa janela de 20 min — não mandamos
  // prazo para eles. Nesse caso o `pg_cron` já devolveu a peça à prateleira e
  // apagou a reserva, então `consumirReserva` não acha nada e o pedido ficaria
  // "pago" sem estoque separado (possivelmente já vendido a outra pessoa).
  //
  // Recusar não é opção: o dinheiro entrou. Então tentamos separar a peça de
  // novo. Se der, o pedido ressuscita e volta para a fila de atendimento; se
  // não der, ele fica pago com o atendimento cancelado — a contradição é
  // proposital, é o que faz a loja olhar e resolver (estorno ou reposição).
  //
  // ⚠️ INCOMPLETO por enquanto: `order.payment_status` foi lido lá em cima, e o
  // pg_cron cabe entre a leitura e esta decisão. O caso comum está coberto (o
  // cron rodou minutos antes), mas na corrida exata o pedido é marcado pago sem
  // que a peça seja separada de novo. Fechar isso exige `marcar_pedido_pago`
  // (migração 0021), que lê e escreve a situação no MESMO comando — falta
  // aplicar a migração e regenerar os tipos.
  const expirou =
    order.payment_status === "expired" || order.payment_status === "canceled";
  let semSaldo: string[] = [];
  if (expirou) {
    semSaldo = await baixarEstoque(admin, await itensDoPedido(admin, order.id));
    await logAudit(null, {
      action: semSaldo.length ? "stock.shortage" : "payment.fora_do_prazo",
      entityType: "order",
      entityId: order.id,
      entityLabel: `nº ${order.number}`,
      metadata: {
        situacao_anterior: order.payment_status,
        // "encerrado" e não "vencido": `canceled` também vem do cliente
        // cancelando pela conta, não só da expiração pelo pg_cron.
        aviso: semSaldo.length
          ? `pagamento chegou depois de o pedido ser encerrado (${order.payment_status}) e não há mais saldo — precisa de estorno ou reposição`
          : `pagamento chegou depois de o pedido ser encerrado (${order.payment_status}); a peça foi separada de novo`,
        ...(semSaldo.length ? { itens: semSaldo } : {}),
      },
    });
  }

  await admin
    .from("orders")
    .update({
      payment_status: "paid",
      // Só devolve o atendimento à fila quando há peça de verdade para entregar.
      ...(expirou && semSaldo.length === 0
        ? { fulfillment_status: "pending" }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  // Só agora o cupom do pedido ONLINE conta como usado: o dinheiro entrou.
  // (A trava de idempotência acima garante que roda uma vez por transação.)
  if (order.coupon_code) await consumeCoupon(admin, order.coupon_code);

  // A peça JÁ saiu do estoque na criação do pedido (reserva, migração 0018).
  // Aqui só se apaga a reserva: baixar de novo venderia a mesma peça duas vezes.
  // (No caminho do `expirou` acima não há reserva para consumir — o cron já a
  // apagou —, e por isso a baixa de lá é a que vale.)
  // (Não invalida o cache do catálogo aqui: esta função também roda dentro do
  // render de /pedido/confirmado, e revalidar durante um render é proibido.
  // Quem invalida é a rota do webhook, que chama revalidateTag sempre que vê
  // `paid` — inclusive no ramo `expirou` acima, que é o único onde o estoque
  // se move aqui dentro. Se só o retorno do cliente chegar, a vitrine se
  // acerta na janela de fallback de 5-10 min.)
  await consumirReserva(admin, order.id);
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
      (
        order as unknown as {
          order_items: {
            product_name: string;
            variant_label: string | null;
            unit_price: number;
            qty: number;
          }[];
        }
      ).order_items ?? []
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
