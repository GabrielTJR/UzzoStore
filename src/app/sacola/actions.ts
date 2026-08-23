"use server";

import { headers } from "next/headers";
import { updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { getSessionUser } from "@/lib/session";
import { getAdminUser } from "@/lib/admin";
import { reservarParaPedido, liberarReserva } from "@/lib/stock";
import { CACHE_TAGS } from "@/lib/products";
import { sendNewOrderAdminEmail } from "@/lib/email";
import {
  createPaymentLink,
  infinitepayHandle,
  toCents,
} from "@/lib/infinitepay";
import { quoteShipping, pesoDaPeca, shippingConfigured } from "@/lib/shipping";
import { checkCoupon, consumeCoupon } from "@/lib/coupons";

/**
 * Registra o pedido no banco ao finalizar a compra.
 *
 * Os preços NÃO vêm do carrinho (o cliente poderia adulterar o localStorage):
 * o servidor relê preço e nome do produto pela variante e monta o pedido a
 * partir disso. `order_items` guarda o snapshot — o catálogo muda, o pedido não.
 *
 * Escrita com service_role de propósito: `orders`/`order_items` não têm policy
 * de INSERT (migração 0001) — o cliente nunca grava pedido direto.
 */

export type CheckoutItem = { variantId: string; qty: number };

export type CheckoutResult = {
  ok: boolean;
  error?: string;
  orderNumber?: number;
  /** Números CONFIRMADOS pelo servidor — a UI exibe estes, não os locais. */
  totals?: {
    subtotal: number;
    discount: number;
    shippingCost: number;
    shippingName: string | null;
    total: number;
  };
};

/** Frete/cupom escolhidos na sacola. O preço NÃO vem daqui: o servidor recota
 * pelo CEP + serviço e recusa se a escolha não existir mais. */
export type OrderExtras = {
  couponCode?: string | null;
  freight?: {
    cep: string;
    serviceId: number;
    /** preço que a tela mostrou — referência anti-surpresa, nunca fonte */
    expectedPrice?: number;
  } | null;
};

type VariantRow = {
  id: string;
  size: string | null;
  color: string | null;
  products: {
    name: string;
    price: number | null;
    promo_price: number | null;
    weight_grams: number | null;
    category_name: string | null;
  } | null;
};

/**
 * Pagamento online: exige login (a loja quis identificar quem paga pelo site),
 * registra o pedido e devolve a URL do checkout da InfinitePay.
 * Só os produtos são cobrados — frete é combinado depois no WhatsApp.
 */
export type ShippingChoice =
  { method: "pickup" } | { method: "delivery"; addressId: string };

export async function startOnlinePaymentAction(
  items: CheckoutItem[],
  shipping: ShippingChoice,
  extras?: {
    couponCode?: string | null;
    freightServiceId?: number | null;
    freightExpectedPrice?: number | null;
  },
): Promise<{
  ok: boolean;
  url?: string;
  error?: string;
  needsLogin?: boolean;
}> {
  const user = await getSessionUser();
  if (!user) return { ok: false, needsLogin: true, error: "Entre para pagar." };
  if (!infinitepayHandle())
    return { ok: false, error: "Pagamento online ainda não está configurado." };

  const admin0 = createAdminClient();

  // Dados obrigatórios para faturar/entregar.
  const { data: profile0 } = await admin0
    .from("customers")
    .select("full_name, cpf, phone")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile0?.full_name || !profile0.cpf || !profile0.phone)
    return { ok: false, error: "Complete seus dados (nome, CPF e telefone)." };

  // Endereço: precisa ser do próprio cliente (o id vem do navegador).
  let shippingAddress: Record<string, unknown> | null = null;
  if (shipping.method === "delivery") {
    const { data: addr } = await admin0
      .from("addresses")
      .select("*")
      .eq("id", shipping.addressId)
      .eq("customer_id", user.id)
      .maybeSingle();
    if (!addr)
      return { ok: false, error: "Escolha um endereço de entrega válido." };
    shippingAddress = {
      label: addr.label,
      cep: addr.cep,
      street: addr.street,
      number: addr.number,
      complement: addr.complement,
      district: addr.district,
      city: addr.city,
      state: addr.state,
    };
  }

  // Frete só faz sentido com entrega; o CEP usado é o do ENDEREÇO validado
  // acima (nunca um CEP solto vindo do navegador).
  const freight =
    shipping.method === "delivery" &&
    extras?.freightServiceId != null &&
    shippingAddress?.cep
      ? {
          cep: String(shippingAddress.cep),
          serviceId: extras.freightServiceId,
          expectedPrice: extras.freightExpectedPrice ?? undefined,
        }
      : null;
  // Com o frete configurado, entrega exige uma opção escolhida — sem isso o
  // pedido nasceria sem frete e a loja pagaria o envio do próprio bolso.
  if (shipping.method === "delivery" && shippingConfigured() && !freight)
    return { ok: false, error: "Escolha uma opção de frete." };

  const order = await createOrderAction(
    items,
    "online",
    {
      shippingMethod: shipping.method,
      shippingAddress,
    },
    { couponCode: extras?.couponCode ?? null, freight },
  );
  if (!order.ok || !order.orderNumber)
    return { ok: false, error: order.error ?? "Erro ao criar o pedido." };

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("order_items")
    .select(
      "product_name, variant_label, unit_price, qty, orders!inner ( number )",
    )
    .eq("orders.number", order.orderNumber);

  // Cada linha vira UM item com o total da linha (quantity 1): é o único jeito
  // de aplicar o desconto do cupom com precisão de centavo — desconto por
  // unidade não fecha a soma, e a conferência do webhook exige que a soma dos
  // itens seja EXATAMENTE o total do pedido.
  const totals = order.totals!;
  const lineCents = (rows ?? []).map((r) => ({
    cents: toCents(Number(r.unit_price)) * r.qty,
    description:
      `${r.qty}× ` +
      [r.product_name, r.variant_label].filter(Boolean).join(" — "),
  }));
  if (lineCents.length === 0) return { ok: false, error: "Pedido vazio." };

  // Distribui o desconto SEM nunca negativar linha: proporcional com clamp e
  // a sobra varre as linhas que ainda têm saldo. No fim, um assert garante a
  // invariante que o webhook confere: soma dos itens === total do pedido.
  const discountCents = toCents(totals.discount);
  if (discountCents > 0) {
    const somaOriginal = lineCents.reduce((s, l) => s + l.cents, 0);
    let restante = discountCents;
    for (let i = 0; i < lineCents.length && restante > 0; i++) {
      const proporcional = Math.floor(
        (lineCents[i].cents * discountCents) / somaOriginal,
      );
      const parte = Math.min(restante, proporcional, lineCents[i].cents);
      lineCents[i].cents -= parte;
      restante -= parte;
    }
    for (let i = 0; i < lineCents.length && restante > 0; i++) {
      const parte = Math.min(restante, lineCents[i].cents);
      lineCents[i].cents -= parte;
      restante -= parte;
    }
  }

  const somaItens =
    lineCents.reduce((s, l) => s + l.cents, 0) + toCents(totals.shippingCost);
  if (somaItens !== toCents(totals.total)) {
    // Melhor abortar do que cobrar diferente do que o pedido registra — a
    // conferência do webhook usa exatamente orders.total.
    console.error("[checkout] soma dos itens difere do total", {
      somaItens,
      total: totals.total,
    });
    return { ok: false, error: "Erro ao montar o pagamento. Tente de novo." };
  }

  const items_ = lineCents
    .filter((l) => l.cents > 0)
    .map((l) => ({ quantity: 1, price: l.cents, description: l.description }));
  if (totals.shippingCost > 0) {
    items_.push({
      quantity: 1,
      price: toCents(totals.shippingCost),
      description: `Frete — ${totals.shippingName ?? "envio"}`,
    });
  }

  const { data: profile } = await admin
    .from("customers")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  const site = siteUrl();
  const link = await createPaymentLink({
    items: items_,
    orderNsu: String(order.orderNumber),
    redirectUrl: `${site}/pedido/confirmado`,
    webhookUrl: `${site}/api/infinitepay/webhook`,
    customer: {
      name: profile?.full_name,
      email: user.email,
      phone: profile?.phone,
    },
    // Na entrega, repassa o endereço que o cliente já escolheu: sem isto ele
    // redigita CEP e rua no checkout deles, logo depois de tê-los informado
    // aqui para cotar o frete. Na retirada não existe endereço.
    address: shippingAddress?.cep
      ? {
          cep: String(shippingAddress.cep),
          street: (shippingAddress.street as string | null) ?? null,
          neighborhood: (shippingAddress.district as string | null) ?? null,
          number: (shippingAddress.number as string | null) ?? null,
          complement: (shippingAddress.complement as string | null) ?? null,
        }
      : null,
  });
  if (!link.ok || !link.url) {
    // O pedido já está gravado, mas sem link não há como pagar. Deixá-lo
    // "pending" enche o painel de pedido fantasma — foi o que aconteceu com os
    // nº 1007, 1008 e 1010 enquanto o handle esteve inválido. Cancelamos em vez
    // de apagar: a tentativa frustrada é informação útil para a loja, e a falha
    // em si já fica registrada como `payment.link_failed` em /admin/logs.
    const { data: cancelado } = await admin
      .from("orders")
      .update({
        payment_status: "canceled",
        fulfillment_status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("number", order.orderNumber)
      .select("id")
      .maybeSingle();

    // Sem devolver, a peça ficaria presa até a expiração por um pedido que
    // já nasceu morto — e a vitrine mostraria "esgotado" sem ninguém comprando.
    if (cancelado) {
      await liberarReserva(admin, cancelado.id);
      updateTag(CACHE_TAGS.catalogo); // a peça voltou para a prateleira
    }

    // Para o admin, mostra a resposta crua da InfinitePay — sem isso a tela só
    // diz "erro" e não dá para descobrir o que o provedor recusou.
    const adminUser = await getAdminUser();
    return {
      ok: false,
      error:
        adminUser && link.detail
          ? `${link.error ?? "Erro ao gerar o pagamento."} [${link.detail}]`
          : (link.error ?? "Erro ao gerar o pagamento."),
    };
  }

  return { ok: true, url: link.url };
}

/**
 * Prazo do pedido online não pago. A reserva de estoque e a expiração usam o
 * MESMO valor de propósito: se a reserva morresse antes, alguém pagaria um
 * pedido cuja peça já voltou para a prateleira — o oversell que ela veio
 * impedir. Curto porque o PIX confirma em minutos.
 */
const JANELA_PAGAMENTO_MIN = 20;

/** Quantos pedidos o mesmo IP pode abrir na janela abaixo. */
const LIMITE_PEDIDOS = 8;
const JANELA_MINUTOS = 10;

/**
 * Freio simples por IP, contado no próprio `audit_log` (que já grava o IP de
 * cada evento) — não precisa de tabela nova nem de serviço externo.
 *
 * Falha ABERTO de propósito: se a contagem der erro, deixamos o pedido passar.
 * Barrar venda de cliente real por causa de um problema no log seria pior do
 * que o abuso que estamos tentando evitar.
 */
async function excedeuLimite(
  admin: ReturnType<typeof createAdminClient>,
): Promise<boolean> {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
    if (!ip) return false; // sem IP (ex.: local) não dá para limitar

    const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000).toISOString();
    const { count, error } = await admin
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "order.create")
      .eq("ip", ip)
      .gte("created_at", desde);
    if (error) return false;
    return (count ?? 0) >= LIMITE_PEDIDOS;
  } catch {
    return false;
  }
}

/** Base pública do site (a InfinitePay precisa de URLs absolutas). */
function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : "https://uzzostore.com.br";
}

/**
 * Confere o saldo de cada item e devolve o que faltou. É uma verificação
 * "de aviso": a garantia de verdade vem do decremento atômico no pagamento
 * (função decrement_stock, migração 0012).
 */
async function stockShortages(
  admin: ReturnType<typeof createAdminClient>,
  rows: {
    variant_id: string;
    product_name: string;
    variant_label: string | null;
    qty: number;
  }[],
): Promise<{ name: string; available: number }[]> {
  const { data } = await admin
    .from("stock_cache")
    .select("variant_id, qty_available")
    .in(
      "variant_id",
      rows.map((r) => r.variant_id),
    )
    .eq("deposito_id", "loja");

  const saldo = new Map(
    (data ?? []).map((s) => [s.variant_id, s.qty_available] as const),
  );
  const falta: { name: string; available: number }[] = [];
  for (const r of rows) {
    const disponivel = saldo.get(r.variant_id) ?? 0;
    if (disponivel < r.qty)
      falta.push({
        name: [r.product_name, r.variant_label].filter(Boolean).join(" — "),
        available: disponivel,
      });
  }
  return falta;
}

export async function createOrderAction(
  items: CheckoutItem[],
  channel: "whatsapp" | "online" = "whatsapp",
  shipping?: {
    shippingMethod: "pickup" | "delivery";
    shippingAddress: Record<string, unknown> | null;
  },
  extras?: OrderExtras,
): Promise<CheckoutResult> {
  const clean = (Array.isArray(items) ? items : [])
    .map((i) => ({
      variantId: String(i?.variantId ?? ""),
      qty: Math.max(1, Math.min(99, Math.floor(Number(i?.qty) || 0))),
    }))
    .filter((i) => i.variantId && i.qty > 0);

  if (clean.length === 0) return { ok: false, error: "Sacola vazia." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return { ok: false, error: "Loja indisponível no momento." };

  const admin = createAdminClient();

  // Server Action é endpoint público e aqui o login é opcional: sem freio, o
  // mesmo payload válido pode ser reenviado em laço, enchendo `orders` e
  // gastando a cota do Resend — quando ela acaba, os avisos de pedido PAGO
  // param de sair em silêncio. O limite é por IP e generoso o bastante para
  // não pegar cliente indeciso.
  if (await excedeuLimite(admin)) {
    return {
      ok: false,
      error: "Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo.",
    };
  }
  const { data, error } = await admin
    .from("product_variants")
    .select(
      "id, size, color, products ( name, price, promo_price, weight_grams, category_name )",
    )
    .in(
      "id",
      clean.map((i) => i.variantId),
    );
  if (error || !data) return { ok: false, error: "Erro ao montar o pedido." };

  const byId = new Map(
    (data as unknown as VariantRow[]).map((v) => [v.id, v] as const),
  );

  const rows: {
    variant_id: string;
    product_name: string;
    variant_label: string | null;
    unit_price: number;
    qty: number;
    weight_grams: number;
  }[] = [];

  for (const item of clean) {
    const v = byId.get(item.variantId);
    if (!v?.products) continue; // variante sumiu do catálogo: ignora
    const price =
      v.products.promo_price != null && Number(v.products.promo_price) > 0
        ? Number(v.products.promo_price)
        : Number(v.products.price ?? 0);
    if (!Number.isFinite(price) || price <= 0) continue;

    const label = [v.color, v.size].filter(Boolean).join(" / ") || null;
    rows.push({
      variant_id: v.id,
      product_name: v.products.name,
      variant_label: label,
      unit_price: price,
      qty: item.qty,
      weight_grams: pesoDaPeca(
        v.products.weight_grams,
        v.products.category_name,
      ),
    });
  }

  if (rows.length === 0)
    return { ok: false, error: "Os itens da sacola não estão mais à venda." };

  // Estoque: a sacola vive no navegador do cliente e pode ficar dias parada —
  // a peça pode ter esgotado (inclusive vendida na loja física) nesse meio
  // tempo. Sem esta checagem a loja recebe dinheiro por algo que não tem.
  const falta = await stockShortages(admin, rows);
  if (falta.length > 0) {
    const detalhe = falta
      .map((f) =>
        f.available === 0
          ? `${f.name} esgotou`
          : `${f.name}: só restam ${f.available}`,
      )
      .join("; ");
    return { ok: false, error: `Estoque insuficiente — ${detalhe}.` };
  }

  const subtotal = rows.reduce((s, r) => s + r.unit_price * r.qty, 0);
  const user = await getSessionUser(); // pedido de visitante fica sem cliente

  // Cupom: validado AGORA, contra o subtotal relido — o que a sacola mostrou
  // é cortesia. Cupom inválido barra o pedido em vez de seguir sem desconto:
  // cobrar mais do que a tela prometeu é pior do que pedir para tentar de novo.
  let discount = 0;
  let couponCode: string | null = null;
  if (extras?.couponCode) {
    const c = await checkCoupon(admin, extras.couponCode, subtotal);
    if (!c.ok) return { ok: false, error: `Cupom: ${c.error}` };
    discount = c.discount;
    couponCode = c.code;
  }

  // Frete: RECOTADO no servidor pelo CEP + serviço escolhido. O preço que veio
  // da sacola morre aqui — localStorage não decide dinheiro.
  let shippingCost = 0;
  let shippingService: string | null = null;
  if (extras?.freight) {
    const quote = await quoteShipping({
      cepDestino: extras.freight.cep,
      itens: rows.map((r) => ({
        weightGrams: r.weight_grams,
        price: r.unit_price,
        qty: r.qty,
      })),
    });
    if (!quote)
      return {
        ok: false,
        error:
          "A cotação de frete está fora do ar — tente de novo em instantes.",
      };
    const opt = quote.options.find(
      (o) => o.serviceId === extras.freight!.serviceId,
    );
    if (!opt)
      return {
        ok: false,
        error: "O frete mudou — recalcule na sacola antes de finalizar.",
      };
    // O preço exibido vem como REFERÊNCIA (nunca como fonte): se a recotação
    // ficou MAIS CARA que o que a tela prometeu, recusa em vez de cobrar a
    // diferença em silêncio. Mais barato/igual segue.
    if (
      extras.freight.expectedPrice != null &&
      opt.price > extras.freight.expectedPrice + 0.005
    )
      return {
        ok: false,
        error: "O frete mudou — recalcule na sacola antes de finalizar.",
      };
    shippingCost = opt.price;
    shippingService = `${opt.name}${opt.company ? ` (${opt.company})` : ""}`;
  }

  const total = Math.max(0, subtotal - discount + shippingCost);

  // A InfinitePay recusa cobrança abaixo de R$ 1,00 com um 422 GENÉRICO (o
  // mesmo de handle inválido) — sem esta guarda, um cupom generoso num item
  // barato criaria pedido cancelado fantasma com erro indiagnosticável.
  if (channel === "online" && total < 1)
    return {
      ok: false,
      error: "O valor mínimo para pagamento online é R$ 1,00.",
    };

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      customer_id: user?.id ?? null,
      payment_status: "pending",
      // Pedido online não pago vira lixo: expira em 20 min (o relógio roda no
      // pg_cron, dentro do Postgres, para não gastar invocação da Vercel). No
      // WhatsApp fica nulo — lá o pagamento é combinado por fora e pode levar
      // dias, então expirar seria cancelar venda boa.
      expires_at:
        channel === "online"
          ? new Date(Date.now() + JANELA_PAGAMENTO_MIN * 60_000).toISOString()
          : null,
      subtotal,
      discount,
      coupon_code: couponCode,
      shipping_cost: shippingCost,
      shipping_service: shippingService,
      total,
      channel,
      shipping_method: shipping?.shippingMethod ?? null,
      shipping_address: (shipping?.shippingAddress ?? null) as never,
    })
    .select("id, number")
    .single();
  if (orderErr || !order)
    return { ok: false, error: "Não foi possível registrar o pedido." };

  const { error: itemsErr } = await admin.from("order_items").insert(
    // o peso serve só para a cotação — não é coluna de order_items
    rows.map(({ weight_grams: _peso, ...r }) => ({ ...r, order_id: order.id })),
  );
  if (itemsErr) {
    // Sem itens o pedido é lixo: desfaz para não sujar o histórico/admin.
    await admin.from("orders").delete().eq("id", order.id);
    return { ok: false, error: "Não foi possível registrar os itens." };
  }

  // Pedido online SEGURA a peça já aqui, por JANELA_PAGAMENTO_MIN. Sem isso
  // dois clientes conseguem pagar a mesma última peça e a loja tem que estornar
  // um deles. A checagem de saldo lá em cima é só aviso — a garantia é esta,
  // porque a decisão acontece dentro do UPDATE do banco.
  // No WhatsApp não há reserva: lá a baixa é quando o admin confirma o
  // pagamento, já que não existe prazo para esperar.
  if (channel === "online") {
    const falta = await reservarParaPedido(
      admin,
      order.id,
      rows.map(({ weight_grams: _peso, ...r }) => r),
      new Date(Date.now() + JANELA_PAGAMENTO_MIN * 60_000).toISOString(),
    );
    if (falta.length > 0) {
      await admin.from("orders").delete().eq("id", order.id);
      return {
        ok: false,
        error: `Estoque insuficiente — ${falta.join("; ")}.`,
      };
    }
    // A peça saiu do estoque agora: sem derrubar a etiqueta, a vitrine
    // continuaria oferecendo por minutos e um segundo cliente só descobriria
    // na recusa do checkout. Invalidar aqui é barato — começar checkout é
    // evento de conversão, não de navegação.
    updateTag(CACHE_TAGS.catalogo);
  }

  // Alimenta a contagem do freio por IP acima (e deixa rastro em /admin/logs
  // de pedido aberto por visitante sem conta).
  // WhatsApp: consome o uso na criação (o pedido segue para conversa humana).
  // ONLINE: quem consome é o confirmPayment, DEPOIS do dinheiro entrar — senão
  // link recusado/retry queimaria usos de cupom com max_uses sem venda nenhuma.
  if (couponCode && channel === "whatsapp")
    await consumeCoupon(admin, couponCode);

  await logAudit(null, {
    action: "order.create",
    entityType: "order",
    entityId: order.id,
    entityLabel: `nº ${order.number}`,
    metadata: {
      canal: channel,
      itens: rows.length,
      total,
      cupom: couponCode,
      frete: shippingService,
    },
  });

  // Avisa a loja. Pedido pago no site é avisado no confirmPayment (só depois
  // de o dinheiro entrar); aqui cobrimos o caminho do WhatsApp.
  if (channel === "whatsapp") {
    let name: string | null = null;
    let phone: string | null = null;
    if (user) {
      const { data: p } = await admin
        .from("customers")
        .select("full_name, phone")
        .eq("id", user.id)
        .maybeSingle();
      name = p?.full_name ?? null;
      phone = p?.phone ?? null;
    }
    await sendNewOrderAdminEmail({
      orderNumber: order.number,
      total,
      items: rows.map((r) => ({
        productName: r.product_name,
        variantLabel: r.variant_label,
        unitPrice: r.unit_price,
        qty: r.qty,
      })),
      customerName: name,
      customerPhone: phone,
      channel: "whatsapp",
      shipping: null,
    });
  }

  return {
    ok: true,
    orderNumber: order.number,
    totals: {
      subtotal,
      discount,
      shippingCost,
      shippingName: shippingService,
      total,
    },
  };
}
