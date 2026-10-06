import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendOrderPaidEmail,
  sendNewOrderAdminEmail,
  linhaEndereco,
  linhaFreteLoja,
  type OrderEmailAddress,
} from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { consumirReserva, baixarEstoque, itensDoPedido } from "@/lib/stock";
import { consumeCoupon } from "@/lib/coupons";
import { siteUrl } from "@/lib/site-url";

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

/**
 * A URL é mesmo do checkout da InfinitePay? https e host `infinitepay.io` ou
 * subdomínio dele. O cliente é mandado direto para esta URL com a compra na
 * mão: uma resposta adulterada (ou um registro guardado mexido) não pode
 * virar redirecionamento para outro site.
 */
export function urlInfinitepay(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (
      u.protocol === "https:" &&
      (host === "infinitepay.io" || host.endsWith(".infinitepay.io"))
    );
  } catch {
    return false;
  }
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

    if (!urlInfinitepay(url)) {
      console.error("[infinitepay] resposta sem URL válida", text);
      await logAudit(null, {
        action: "payment.link_failed",
        entityType: "order",
        entityLabel: `nº ${params.orderNsu}`,
        metadata: {
          motivo: "resposta sem URL válida da InfinitePay",
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

/**
 * Monta os itens do link a partir do pedido JÁ GRAVADO. Função pura.
 *
 * Cada linha vira UM item com o total da linha (quantity 1): é o único jeito
 * de aplicar o desconto do cupom com precisão de centavo — desconto por
 * unidade não fecha a soma, e a conferência do webhook exige que a soma dos
 * itens seja EXATAMENTE o total do pedido.
 *
 * O desconto é distribuído SEM nunca negativar linha: proporcional com clamp,
 * e a sobra varre as linhas que ainda têm saldo. O frete entra como item
 * próprio. Devolve `null` quando a soma não bate com `totalCents` — melhor
 * abortar do que cobrar diferente do que o pedido registra.
 */
export function itensDoLink(params: {
  linhas: { cents: number; description: string }[];
  descontoCents: number;
  freteCents: number;
  freteNome: string | null;
  totalCents: number;
}): LinkItem[] | null {
  const linhas = params.linhas.map((l) => ({ ...l }));
  if (linhas.length === 0) return null;

  const discountCents = params.descontoCents;
  if (discountCents > 0) {
    const somaOriginal = linhas.reduce((s, l) => s + l.cents, 0);
    let restante = discountCents;
    for (let i = 0; i < linhas.length && restante > 0; i++) {
      const proporcional = Math.floor(
        (linhas[i].cents * discountCents) / somaOriginal,
      );
      const parte = Math.min(restante, proporcional, linhas[i].cents);
      linhas[i].cents -= parte;
      restante -= parte;
    }
    for (let i = 0; i < linhas.length && restante > 0; i++) {
      const parte = Math.min(restante, linhas[i].cents);
      linhas[i].cents -= parte;
      restante -= parte;
    }
  }

  const soma = linhas.reduce((s, l) => s + l.cents, 0) + params.freteCents;
  if (soma !== params.totalCents) return null;

  const items: LinkItem[] = linhas
    .filter((l) => l.cents > 0)
    .map((l) => ({ quantity: 1, price: l.cents, description: l.description }));
  if (params.freteCents > 0)
    items.push({
      quantity: 1,
      price: params.freteCents,
      description: `Frete — ${params.freteNome ?? "envio"}`,
    });
  return items;
}

/**
 * Onde o link de cada pedido fica guardado: no próprio `audit_log`, como o
 * evento "link criado" (com a URL nos metadados). Sem coluna nova em `orders`
 * e sem migração — e o evento já seria útil no /admin/logs de qualquer jeito.
 * O índice (entity_type, entity_id) da migração 0003 cobre a busca.
 */
const ACAO_LINK_CRIADO = "payment.link_created";

async function linkGuardado(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  totalCents: number,
): Promise<string | null> {
  const { data } = await admin
    .from("audit_log")
    .select("metadata")
    .eq("entity_type", "order")
    .eq("entity_id", orderId)
    .eq("action", ACAO_LINK_CRIADO)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const m = (data?.metadata ?? null) as {
    url?: unknown;
    total_centavos?: unknown;
  } | null;
  // Só reaproveita link do MESMO valor: o pedido não muda depois de gravado,
  // mas se um dia mudar, cobrar pelo link antigo seria cobrar outro total.
  if (urlInfinitepay(m?.url) && m.total_centavos === totalCents) return m.url;
  return null;
}

export type LinkDoPedido = {
  ok: boolean;
  url?: string;
  error?: string;
  /** resposta crua do provedor — só para o admin ver */
  detail?: string;
  /** a URL é a que já existia (nenhum link novo foi criado) */
  reaproveitado?: boolean;
};

/**
 * Link de pagamento de um pedido online JÁ GRAVADO, montado só com o que está
 * no banco (o pedido é o snapshot: preço, cupom e frete foram decididos na
 * criação e não são recalculados aqui).
 *
 * `reaproveitar`: devolve o link criado antes para este pedido, se houver. É o
 * caminho preferido para "pagar de novo": o link da InfinitePay não expira
 * (não mandamos prazo) e continua pagável, então gerar outro deixaria DOIS
 * links vivos para o mesmo pedido — e cada pagamento é uma transação própria,
 * que a trava de `payments` (por transação) não reconhece como repetida. Só
 * quando não há link guardado (pedido anterior a esta mudança, ou o registro
 * falhou) criamos outro com o MESMO `order_nsu`: o `confirmPayment` confere
 * pedido + transação + slug, então o segundo link confirma do mesmo jeito.
 *
 * Quem chama decide o que fazer na falha (a regra da casa é cancelar e
 * devolver a reserva — pedido pendente sem link não serve para nada).
 */
export async function linkDoPedido(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  opts: { email?: string | null; reaproveitar: boolean },
): Promise<LinkDoPedido> {
  const { data } = await admin
    .from("orders")
    .select(
      "id, number, total, discount, shipping_cost, shipping_service, shipping_method, shipping_address, customer_id, order_items ( product_name, variant_label, unit_price, qty )",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Pedido não encontrado." };
  const order = data as unknown as {
    id: string;
    number: number;
    total: number;
    discount: number | null;
    shipping_cost: number | null;
    shipping_service: string | null;
    shipping_method: string | null;
    shipping_address: {
      cep?: string | null;
      street?: string | null;
      district?: string | null;
      number?: string | null;
      complement?: string | null;
    } | null;
    customer_id: string | null;
    order_items: {
      product_name: string;
      variant_label: string | null;
      unit_price: number;
      qty: number;
    }[];
  };
  const totalCents = toCents(Number(order.total));

  if (opts.reaproveitar) {
    const url = await linkGuardado(admin, order.id, totalCents);
    if (url) return { ok: true, url, reaproveitado: true };
  }

  const items = itensDoLink({
    linhas: (order.order_items ?? []).map((r) => ({
      cents: toCents(Number(r.unit_price)) * r.qty,
      description:
        `${r.qty}× ` +
        [r.product_name, r.variant_label].filter(Boolean).join(" — "),
    })),
    descontoCents: toCents(Number(order.discount ?? 0)),
    freteCents: toCents(Number(order.shipping_cost ?? 0)),
    freteNome: order.shipping_service,
    totalCents,
  });
  if (!items) {
    console.error("[infinitepay] itens do pedido não fecham o total", {
      pedido: order.number,
      total: order.total,
    });
    return { ok: false, error: "Erro ao montar o pagamento. Tente de novo." };
  }

  const { data: profile } = order.customer_id
    ? await admin
        .from("customers")
        .select("full_name, phone")
        .eq("id", order.customer_id)
        .maybeSingle()
    : { data: null };

  const addr =
    order.shipping_method === "delivery" ? order.shipping_address : null;
  const link = await createPaymentLink({
    items,
    orderNsu: String(order.number),
    redirectUrl: `${siteUrl()}/pedido/confirmado`,
    webhookUrl: `${siteUrl()}/api/infinitepay/webhook`,
    customer: {
      name: profile?.full_name,
      email: opts.email,
      phone: profile?.phone,
    },
    // Na entrega, repassa o endereço que o cliente já escolheu: sem isto ele
    // redigita CEP e rua no checkout deles, logo depois de tê-los informado
    // aqui para cotar o frete. Na retirada não existe endereço.
    address: addr?.cep
      ? {
          cep: String(addr.cep),
          street: addr.street ?? null,
          neighborhood: addr.district ?? null,
          number: addr.number ?? null,
          complement: addr.complement ?? null,
        }
      : null,
  });

  if (link.ok && link.url)
    await logAudit(null, {
      action: ACAO_LINK_CRIADO,
      entityType: "order",
      entityId: order.id,
      entityLabel: `nº ${order.number}`,
      metadata: { url: link.url, total_centavos: totalCents },
    });
  return link;
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
 * Confirma um pagamento e, se legítimo, marca o pedido como pago. Idempotente
 * e retomável: webhook e retorno do cliente chegam os dois, e quem faz o resto
 * é só a chamada que tirou o pedido de "não pago" (`marcar_pedido_pago`). Uma
 * chamada que morreu no meio é terminada pela próxima.
 */
export async function confirmPayment(params: {
  orderNsu: string;
  transactionNsu: string;
  slug: string;
}): Promise<ConfirmResult> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return { paid: false, reason: "config" };

  // O pedido é procurado ANTES de perguntar à InfinitePay: o webhook e o
  // retorno são endereços públicos, e com a ordem inversa qualquer POST com
  // três campos inventados virava uma chamada externa — em laço, sem freio.
  // Número que não é de pedido online nosso nem chega a sair daqui.
  const number = Number(params.orderNsu);
  if (!/^\d{1,9}$/.test(params.orderNsu) || !Number.isFinite(number))
    return { paid: false, reason: "pedido" };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, number, total, payment_status, coupon_code")
    .eq("number", number)
    .eq("channel", "online")
    .maybeSingle();
  if (!order) return { paid: false, reason: "pedido" };

  const check = await paymentCheck(params);
  if (!check?.paid) return { paid: false, reason: "nao_pago" };

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

  // Registro da transação (unique por provider+provider_id). Já existir NÃO
  // encerra a conversa: quem decide se ainda há trabalho é o passo seguinte.
  const { error: payErr } = await admin.from("payments").insert({
    order_id: order.id,
    provider: "infinitepay",
    provider_id: params.transactionNsu,
    status: "approved",
    amount: paidCents / 100,
    raw: { ...check, slug: params.slug },
  });
  if (payErr && payErr.code !== "23505") {
    // Só a violação do unique (provider+provider_id) significa "já registrado".
    // Qualquer outro erro — timeout, indisponibilidade — NÃO pode responder
    // "pago": o webhook receberia 200, a InfinitePay nunca reenviaria, e o
    // pedido ficaria parado com o dinheiro dentro.
    console.error("[infinitepay] falha ao gravar o pagamento", payErr);
    return { paid: false, orderNumber: order.number, reason: "erro" };
  }

  // Marca pago e descobre, NO MESMO COMANDO, em que situação o pedido estava
  // (`marcar_pedido_pago`, migração 0021: trava a linha, lê, escreve).
  //
  // É essa resposta — e não a linha em `payments` — que decide quem faz o
  // resto (separar a peça de novo, consumir o cupom, apagar a reserva, mandar
  // o e-mail). Antes, a linha em `payments` era a trava: se o processo morresse
  // entre gravá-la e marcar o pedido, toda tentativa seguinte batia no unique,
  // respondia "já processado" e o pedido ficava `pending` para sempre — o
  // pg_cron o expirava e a peça voltava à vitrine com o dinheiro já recebido.
  // Agora o reenvio do webhook (ou o "atualizar" do cliente) cai aqui de novo
  // e termina o serviço; e duas chamadas simultâneas não fazem o resto em
  // dobro, porque só uma encontra o pedido ainda não pago.
  const { data: anterior, error: markErr } = await admin.rpc(
    "marcar_pedido_pago",
    { p_order_id: order.id },
  );
  if (markErr) {
    console.error("[infinitepay] falha ao marcar o pedido como pago", markErr);
    return { paid: false, orderNumber: order.number, reason: "erro" };
  }
  // NULL: estornado (o dinheiro já voltou; não revive) ou pedido sumiu.
  if (anterior === null)
    return { paid: false, orderNumber: order.number, reason: "estornado" };
  if (anterior === "paid")
    return { paid: true, orderNumber: order.number, reason: "ja_processado" };

  // O pedido pode ter sido ENCERRADO antes de o dinheiro chegar: expirado pelo
  // `pg_cron` ou cancelado (pelo cliente, pela loja, ou ao recomeçar a compra).
  // O link da InfinitePay não expira junto com a nossa janela de 20 min. Nesse
  // caso a peça já voltou à prateleira e a reserva foi apagada, então
  // `consumirReserva` não acharia nada e o pedido ficaria "pago" sem estoque
  // separado (possivelmente já vendido a outra pessoa).
  //
  // Recusar não é opção: o dinheiro entrou. Então tentamos separar a peça de
  // novo. Se der, o pedido ressuscita e volta para a fila de atendimento; se
  // não der, ele fica pago com o atendimento cancelado — a contradição é
  // proposital, é o que faz a loja olhar e resolver (estorno ou reposição).
  const expirou = anterior === "expired" || anterior === "canceled";
  let semSaldo: string[] = [];
  if (expirou) {
    semSaldo = await baixarEstoque(admin, await itensDoPedido(admin, order.id));
    await logAudit(null, {
      action: semSaldo.length ? "stock.shortage" : "payment.fora_do_prazo",
      entityType: "order",
      entityId: order.id,
      entityLabel: `nº ${order.number}`,
      metadata: {
        situacao_anterior: anterior,
        // "encerrado" e não "vencido": `canceled` também vem do cliente
        // cancelando pela conta, não só da expiração pelo pg_cron.
        aviso: semSaldo.length
          ? `pagamento chegou depois de o pedido ser encerrado (${anterior}) e não há mais saldo — precisa de estorno ou reposição`
          : `pagamento chegou depois de o pedido ser encerrado (${anterior}); a peça foi separada de novo`,
        ...(semSaldo.length ? { itens: semSaldo } : {}),
      },
    });
    // Só devolve o atendimento à fila quando há peça de verdade para entregar.
    if (semSaldo.length === 0)
      await admin
        .from("orders")
        .update({
          fulfillment_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
  }

  // Só agora o cupom do pedido ONLINE conta como usado: o dinheiro entrou.
  // (Roda uma vez por pedido: só a chamada que tirou o pedido de "não pago"
  // chega até aqui.)
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
        "customer_id, total, subtotal, discount, coupon_code, shipping_method, shipping_address, shipping_cost, shipping_service, order_items ( product_name, variant_label, unit_price, qty )",
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

    const shippingMethod =
      order.shipping_method === "pickup" || order.shipping_method === "delivery"
        ? order.shipping_method
        : null;
    // Retirada não tem endereço de entrega, mesmo que algo tenha sido gravado.
    const addr =
      shippingMethod === "delivery"
        ? (order.shipping_address as OrderEmailAddress | null)
        : null;

    // O e-mail descreve o frete a partir do que FOI gravado no pedido
    // (cobrado, grátis ou a combinar) — ver `fretePedido`.
    await sendOrderPaidEmail({
      to,
      customerName: profile?.full_name ?? null,
      orderNumber,
      items,
      subtotal: Number(order.subtotal ?? 0),
      discount: Number(order.discount ?? 0),
      couponCode: order.coupon_code ?? null,
      shippingMethod,
      shippingCost: Number(order.shipping_cost ?? 0),
      shippingService: order.shipping_service ?? null,
      address: addr,
      total: Number(order.total),
    });

    // A loja também precisa saber que entrou venda — com o nome cru do serviço
    // de frete, que é o que ela procura no Melhor Envio para comprar a etiqueta.
    await sendNewOrderAdminEmail({
      orderNumber,
      total: Number(order.total),
      items,
      customerName: profile?.full_name ?? null,
      customerPhone: profile?.phone ?? null,
      channel: "online",
      shipping: (order.shipping_method as "pickup" | "delivery" | null) ?? null,
      addressLine: linhaEndereco(addr),
      shippingLine: linhaFreteLoja(order),
    });
  } catch (err) {
    console.error("[infinitepay] falha ao avisar pagamento", err);
  }
}
