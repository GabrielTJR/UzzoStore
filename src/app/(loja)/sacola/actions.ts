"use server";

import { headers } from "next/headers";
import { updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { logAudit } from "@/lib/audit";
import { getSessionUser } from "@/lib/session";
import { getAdminUser } from "@/lib/admin";
import { reservarParaPedido, cancelarPedidoPendente } from "@/lib/stock";
import { CACHE_TAGS } from "@/lib/products";
import { sendNewOrderAdminEmail } from "@/lib/email";
import {
  infinitepayHandle,
  linkDoPedido,
  type LinkDoPedido,
} from "@/lib/infinitepay";
import { freiaIp } from "@/lib/rate-limit";
import { quoteShipping, pesoDaPeca, shippingConfigured } from "@/lib/shipping";
import { checkCoupon, consumeCoupon } from "@/lib/coupons";
import { perfilCompleto } from "@/lib/customer-fields";
import { temFolgaParaPagar } from "@/app/(loja)/conta/pedidos/pode-pagar";
import { formatBRL } from "@/lib/format";
import { displayProductName } from "@/lib/product-name";

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

export type CheckoutItem = {
  variantId: string;
  qty: number;
  /** Preço unitário que a TELA mostrou. Referência anti-surpresa, nunca fonte:
   * se o do servidor for maior, a compra é recusada em vez de cobrar mais. */
  price?: number;
};

/**
 * Motivo da recusa em forma de CÓDIGO, para a tela reagir (reabrir o passo
 * certo, recotar o frete, oferecer "Ajustar sacola") sem interpretar texto.
 * O `error` continua sendo a frase exibida — a sacola mostra essas frases.
 */
export type PayCode =
  | "login"
  | "config"
  | "profile"
  | "address"
  | "freight_required"
  | "freight_changed"
  | "freight_down"
  | "stock"
  | "items"
  | "price_changed"
  | "already_paid"
  | "coupon"
  | "rate"
  | "min_total"
  | "payment";

export type CheckoutResult = {
  ok: boolean;
  error?: string;
  code?: PayCode;
  orderNumber?: number;
  /** `price_changed`: preço ATUAL por variante, para a tela corrigir a sacola. */
  precos?: Record<string, number>;
  /** `items`: variantes que saíram da loja, para a tela tirá-las da sacola. */
  fora?: string[];
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
    active_ecommerce: boolean;
    price: number | null;
    promo_price: number | null;
    weight_grams: number | null;
    category_name: string | null;
  } | null;
};

/**
 * Pagamento online: exige login (a loja quis identificar quem paga pelo site),
 * registra o pedido e devolve a URL do checkout da InfinitePay.
 * Na entrega, o frete escolhido é RECOTADO no servidor pelo CEP do endereço do
 * próprio cliente e entra no total como item próprio; só quando a cotação não
 * está configurada (`shippingConfigured()` falso) o pedido segue sem frete,
 * para combinar pelo WhatsApp. Na retirada não há frete.
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
    /** O cliente viu o aviso de "você já pagou um pedido igual" e confirmou
     * que quer comprar de novo. */
    repetir?: boolean;
  },
): Promise<{
  ok: boolean;
  url?: string;
  error?: string;
  needsLogin?: boolean;
  code?: PayCode;
  precos?: Record<string, number>;
  fora?: string[];
  orderNumber?: number;
}> {
  const user = await getSessionUser();
  if (!user)
    return {
      ok: false,
      needsLogin: true,
      code: "login",
      error: "Entre para pagar.",
    };
  // Freio barato ANTES de qualquer trabalho: daqui em diante a action valida
  // cupom e cota frete, e um logado em laço testaria cupons sem passar pelo
  // limite do `checkCouponAction`. Generoso para não pegar quem volta da
  // InfinitePay e tenta de novo algumas vezes.
  if (await freiaIp("payment.start", LIMITE_INICIO_PAGAMENTO))
    return {
      ok: false,
      code: "rate",
      error: "Muitas tentativas seguidas. Aguarde alguns minutos.",
    };
  // Sem a service key o `createAdminClient` LANÇA, e a tela receberia uma
  // exceção crua em vez de uma recusa que ela sabe mostrar.
  if (!infinitepayHandle() || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return {
      ok: false,
      code: "config",
      error: "Pagamento online ainda não está configurado.",
    };

  const admin0 = createAdminClient();

  // Dados obrigatórios para faturar/entregar. `perfilCompleto` é a MESMA
  // regra que a tela usa para liberar o botão — se divergissem, o cliente
  // veria o botão liberado e a recusa só depois do clique.
  const { data: profile0 } = await admin0
    .from("customers")
    .select("full_name, cpf, phone")
    .eq("id", user.id)
    .maybeSingle();
  if (
    !perfilCompleto({
      fullName: profile0?.full_name,
      cpf: profile0?.cpf,
      phone: profile0?.phone,
    })
  )
    return {
      ok: false,
      code: "profile",
      error: "Complete seus dados (nome, CPF e telefone).",
    };

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
      return {
        ok: false,
        code: "address",
        error: "Escolha um endereço de entrega válido.",
      };
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
    return {
      ok: false,
      code: "freight_required",
      error: "Escolha uma opção de frete.",
    };

  const clean = limparItens(items);
  if (clean.length === 0)
    return { ok: false, code: "items", error: "Sacola vazia." };

  // Preço, cupom e frete RELIDOS no servidor antes de qualquer decisão — é
  // com estes números (e não com os da tela) que o pedido pendente é comparado.
  const montado = await montarPedido(admin0, clean, "online", {
    couponCode: extras?.couponCode ?? null,
    freight,
  });
  if (!montado.ok)
    return {
      ok: false,
      code: montado.res.code ?? "payment",
      error: montado.res.error ?? "Erro ao montar o pedido.",
      precos: montado.res.precos,
      fora: montado.res.fora,
    };
  const rascunho = montado.rascunho;
  const entrega = { shippingMethod: shipping.method, shippingAddress };

  // "Pagar de novo": quem foi à InfinitePay e voltou sem pagar ainda tem um
  // pedido pendente SEGURANDO as peças. Criar outro em cima dele reservava a
  // mesma peça duas vezes — na última unidade, o cliente era recusado pela
  // própria reserva.
  const pendentes = await pendentesOnline(admin0, user.id);
  const agora = Date.now();
  const igual = pendentes.find(
    (p) =>
      mesmoPedido(p, rascunho, entrega) &&
      p.expires_at != null &&
      temFolgaParaPagar(p.expires_at, agora),
  );

  if (igual) {
    // Pode virar chamada à InfinitePay (quando não há link guardado): freio
    // por IP como toda action pública que custa algo.
    if (await freiaIp("order.pay_again", LIMITE_PAGAR_DE_NOVO))
      return {
        ok: false,
        code: "rate",
        error: "Muitas tentativas seguidas. Aguarde alguns minutos.",
      };
    // Mesmo pedido: paga ELE (de preferência pelo mesmo link). Qualquer outro
    // pendente do cliente é sobra de tentativa anterior e devolve a peça.
    await cancelarPendentes(
      admin0,
      pendentes.filter((p) => p.id !== igual.id),
    );
    const link = await linkDoPedido(admin0, igual.id, {
      email: user.email,
      reaproveitar: true,
    });
    if (!link.ok || !link.url) {
      // Mesma regra do pedido novo: pendente sem link não serve para nada e
      // prenderia a peça até expirar.
      await cancelaPedidoSemLink(admin0, igual.id);
      return { ok: false, code: "payment", error: await erroDoLink(link) };
    }
    return { ok: true, url: link.url };
  }

  // Cobrança em dobro: a sacola só esvazia quando o retorno da InfinitePay
  // abre no MESMO navegador com o pagamento já confirmado. Quem pagou o PIX em
  // outro aparelho, fechou a aba ou voltou pelo navegador externo (o do
  // Instagram) continua com a sacola cheia — e o pedido pago já não é
  // "pendente" para ser reaproveitado, então um novo toque em "Pagar" criava
  // outro pedido e cobrava de novo. Pergunta antes; o cliente confirma se
  // quer mesmo outra unidade.
  if (!extras?.repetir) {
    const pago = await pagoRecenteIgual(admin0, user.id, rascunho.rows);
    if (pago)
      return {
        ok: false,
        code: "already_paid",
        orderNumber: pago.number,
        error: `Você já pagou um pedido com estas mesmas peças ${pago.minutos <= 1 ? "agora há pouco" : `há ${pago.minutos} minutos`} (nº ${pago.number}). Quer comprar de novo?`,
      };
  }

  // Pedido diferente (mudou a sacola, o endereço, o frete, o cupom ou o preço)
  // ou pendente quase vencendo: os pendentes antigos saem ANTES de o novo
  // reservar — senão a peça que só o cliente segura daria "estoque
  // insuficiente" para ele mesmo, e nunca há dois pendentes dele prendendo
  // estoque ao mesmo tempo.
  if (await excedeuLimite(admin0))
    return {
      ok: false,
      code: "rate",
      error: "Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo.",
    };
  await cancelarPendentes(admin0, pendentes);

  const order = await gravarPedido(admin0, rascunho, "online", entrega);
  if (!order.ok || !order.orderId)
    return {
      ok: false,
      code: order.code ?? "payment",
      error: order.error ?? "Erro ao criar o pedido.",
    };

  const link = await linkDoPedido(admin0, order.orderId, {
    email: user.email,
    reaproveitar: false,
  });
  if (!link.ok || !link.url) {
    // A falha em si já fica registrada como `payment.link_failed` em
    // /admin/logs (ver `createPaymentLink`).
    await cancelaPedidoSemLink(admin0, order.orderId);
    return { ok: false, code: "payment", error: await erroDoLink(link) };
  }

  return { ok: true, url: link.url };
}

/**
 * Frase de erro do link. Para o admin, anexa a resposta crua da InfinitePay —
 * sem isso a tela só diz "erro" e não dá para descobrir o que o provedor
 * recusou.
 */
async function erroDoLink(link: LinkDoPedido): Promise<string> {
  const base = link.error ?? "Erro ao gerar o pagamento.";
  if (!link.detail) return base;
  const adminUser = await getAdminUser();
  return adminUser ? `${base} [${link.detail}]` : base;
}

// A folga mínima para reaproveitar um pendente é `REUSO_MIN_RESTANTE_MIN`
// (conta/pedidos/pode-pagar.ts), a MESMA do "Pagar agora" de Meus pedidos.
// Abaixo dela sai mais barato cancelar e abrir um pedido novo com janela
// cheia. O prazo do pendente NUNCA é esticado: reserva e expiração andam
// juntas, e esticar a cada toque deixaria segurar uma peça para sempre.

/** Quantas vezes o mesmo IP pode começar um pagamento online em 10 min. */
const LIMITE_INICIO_PAGAMENTO = 15;

/** Quantas vezes o mesmo IP pode pedir o link de um pedido existente. */
const LIMITE_PAGAR_DE_NOVO = 10;

/** Pedido online pendente, no formato que `mesmoPedido` compara. */
type PendenteOnline = {
  id: string;
  expires_at: string | null;
  shipping_method: string | null;
  shipping_address: Record<string, unknown> | null;
  shipping_service: string | null;
  shipping_cost: number | null;
  coupon_code: string | null;
  discount: number | null;
  subtotal: number | null;
  total: number | null;
  order_items: { variant_id: string; qty: number; unit_price: number }[];
};

/**
 * Pedidos online ainda não pagos do cliente — inclusive os que já passaram do
 * prazo e o pg_cron ainda não varreu (até 5 min): eles também seguram peça.
 */
async function pendentesOnline(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
): Promise<PendenteOnline[]> {
  const { data } = await admin
    .from("orders")
    .select(
      "id, expires_at, shipping_method, shipping_address, shipping_service, shipping_cost, coupon_code, discount, subtotal, total, order_items ( variant_id, qty, unit_price )",
    )
    .eq("customer_id", customerId)
    .eq("channel", "online")
    .eq("payment_status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []) as unknown as PendenteOnline[];
}

/** Janela em que um pedido PAGO com as mesmas peças conta como "já pagou". */
const JANELA_REPETICAO_MIN = 60;

/**
 * Pedido online PAGO do cliente na última hora com as mesmas peças e
 * quantidades (o preço não entra: é a mesma compra mesmo que a promoção tenha
 * mudado no meio). Uma consulta só, e só quando o cliente toca em "Pagar".
 */
async function pagoRecenteIgual(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
  rows: { variant_id: string; qty: number }[],
): Promise<{ number: number; minutos: number } | null> {
  const desde = new Date(
    Date.now() - JANELA_REPETICAO_MIN * 60_000,
  ).toISOString();
  const { data } = await admin
    .from("orders")
    .select("number, created_at, order_items ( variant_id, qty )")
    .eq("customer_id", customerId)
    .eq("channel", "online")
    .eq("payment_status", "paid")
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(5);
  const chave = (itens: { variant_id: string; qty: number }[]) =>
    chaveItens(itens.map((i) => ({ ...i, unit_price: 0 })));
  const alvo = chave(rows);
  const igual = (
    (data ?? []) as unknown as {
      number: number;
      created_at: string;
      order_items: { variant_id: string; qty: number }[];
    }[]
  ).find((o) => chave(o.order_items ?? []) === alvo);
  if (!igual) return null;
  return {
    number: igual.number,
    minutos: Math.max(
      1,
      Math.round((Date.now() - Date.parse(igual.created_at)) / 60_000),
    ),
  };
}

/** Cancela os pendentes e devolve as peças; derruba o catálogo se algo voltou. */
async function cancelarPendentes(
  admin: ReturnType<typeof createAdminClient>,
  pendentes: { id: string }[],
): Promise<void> {
  let devolveu = false;
  for (const p of pendentes)
    if (await cancelarPedidoPendente(admin, p.id)) devolveu = true;
  if (devolveu) updateTag(CACHE_TAGS.catalogo); // a peça voltou para a vitrine
}

const centavos = (v: unknown) => Math.round(Number(v ?? 0) * 100);

/** Itens como texto canônico: variante, quantidade somada e preço unitário. */
function chaveItens(
  itens: { variant_id: string; qty: number; unit_price: number }[],
): string {
  const porVariante = new Map<string, { qty: number; preco: number }>();
  for (const i of itens) {
    const atual = porVariante.get(i.variant_id);
    porVariante.set(i.variant_id, {
      qty: (atual?.qty ?? 0) + Number(i.qty),
      preco: centavos(i.unit_price),
    });
  }
  return [...porVariante.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([v, { qty, preco }]) => `${v}:${qty}:${preco}`)
    .join("|");
}

const CAMPOS_ENDERECO = [
  "label",
  "cep",
  "street",
  "number",
  "complement",
  "district",
  "city",
  "state",
] as const;

function chaveEndereco(a: Record<string, unknown> | null | undefined): string {
  if (!a) return "";
  return CAMPOS_ENDERECO.map((k) => String(a[k] ?? "").trim()).join("|");
}

/**
 * O pendente é o MESMO pedido que o cliente está pedindo agora? Compara o que
 * define a cobrança — itens (variante + quantidade + preço), entrega,
 * endereço, frete, cupom e totais —, sempre contra o rascunho RECALCULADO no
 * servidor. Preço que mudou no catálogo conta como pedido diferente: o
 * pendente cobraria o valor antigo.
 */
function mesmoPedido(
  p: PendenteOnline,
  r: Rascunho,
  entrega: {
    shippingMethod: "pickup" | "delivery";
    shippingAddress: Record<string, unknown> | null;
  },
): boolean {
  return (
    (p.shipping_method ?? "") === entrega.shippingMethod &&
    chaveEndereco(p.shipping_address) ===
      chaveEndereco(entrega.shippingAddress) &&
    (p.shipping_service ?? "") === (r.shippingService ?? "") &&
    centavos(p.shipping_cost) === centavos(r.shippingCost) &&
    (p.coupon_code ?? "") === (r.couponCode ?? "") &&
    centavos(p.discount) === centavos(r.discount) &&
    centavos(p.subtotal) === centavos(r.subtotal) &&
    centavos(p.total) === centavos(r.total) &&
    chaveItens(p.order_items ?? []) === chaveItens(r.rows)
  );
}

/**
 * Prazo do pedido online não pago. A reserva de estoque e a expiração usam o
 * MESMO valor de propósito: se a reserva morresse antes, alguém pagaria um
 * pedido cuja peça já voltou para a prateleira — o oversell que ela veio
 * impedir. Curto porque o PIX confirma em minutos.
 */
const JANELA_PAGAMENTO_MIN = 20;

/**
 * Saldo atual das variantes que estão na sacola.
 *
 * A sacola vive no localStorage do cliente e pode ficar dias parada: a peça
 * pode ter esgotado, ou estar reservada por outra compra em curso. Sem isto o
 * cliente só descobre a falta ao CLICAR em pagar — depois de calcular frete e
 * aplicar cupom, que é o pior momento para ouvir não.
 *
 * Client PÚBLICO de propósito: `stock_cache` tem leitura liberada (policy
 * `catalog_read_stock`) e é o mesmo número que a página do produto já mostra.
 * Assim funciona sem a service_role e não vaza nada.
 *
 * Sem freio por IP: contar no `audit_log` custaria uma leitura e uma escrita
 * para proteger uma consulta mais barata que elas, e o dado já é público. O
 * teto de itens é o que evita um `IN` gigante.
 */
export type SaldoSacola = { qty: number; reservado: boolean };

export async function cartStockAction(
  variantIds: string[],
): Promise<Record<string, SaldoSacola>> {
  const ids = (Array.isArray(variantIds) ? variantIds : [])
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .slice(0, 50);
  if (ids.length === 0) return {};

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("stock_cache")
    // Peça desativada não tem saldo para ninguém: o embed obrigatório some com
    // a linha, e o laço abaixo a trata como zero ("esgotado" na sacola, com o
    // "Ajustar sacola" que a tira). Antes ela seguia com o saldo antigo.
    .select(
      "variant_id, qty_available, reservado_ate, product_variants!inner ( products!inner ( active_ecommerce ) )",
    )
    .in("variant_id", ids)
    .eq("deposito_id", "loja")
    .eq("product_variants.products.active_ecommerce", true);
  if (error || !data) return {};

  const agora = Date.now();
  const saldo: Record<string, SaldoSacola> = {};
  for (const l of data)
    saldo[l.variant_id] = {
      qty: l.qty_available ?? 0,
      // Vem na MESMA consulta: saldo zero por reserva não é fim de estoque, e
      // dizer "esgotado" para peça que volta em minutos é a mesma mentira que
      // já corrigimos na página do produto.
      reservado: l.reservado_ate != null && Date.parse(l.reservado_ate) > agora,
    };
  // Variante sem linha de estoque = sem saldo, não "saldo desconhecido".
  for (const id of ids)
    if (!(id in saldo)) saldo[id] = { qty: 0, reservado: false };

  // A reserva pode ser do PRÓPRIO cliente: ele foi à InfinitePay, voltou sem
  // pagar, e a peça está presa ao pedido pendente dele. Para ele essa peça
  // está disponível — ao pagar, `startOnlinePaymentAction` reaproveita ou
  // cancela aquele pendente. Sem somar de volta, a tela dizia "em processo de
  // compra por outro cliente" e travava o botão de pagar.
  // Independe da marca `reservado`: o pendente próprio já vencido e ainda não
  // varrido pelo pg_cron (até 5 min) tem `reservado_ate` no passado, e sem
  // isto aparecia como "esgotado". Custo: visitante sem sessão não consulta
  // nada (a sessão é lida do cookie); logado faz uma consulta, e esta action
  // só roda na sacola e no checkout — nunca por visita de vitrine.
  for (const r of await reservasProprias(ids)) {
    if (saldo[r.variant_id]) saldo[r.variant_id].qty += r.qty;
  }
  return saldo;
}

/**
 * Peças reservadas por pedidos online PENDENTES do cliente logado, entre as
 * variantes pedidas. Inclui pendente já vencido que o pg_cron ainda não
 * varreu: ele também é cancelado no próximo pagamento. Falha silenciosa
 * (lista vazia) — é ajuste de exibição, o servidor decide de novo ao pagar.
 */
async function reservasProprias(
  variantIds: string[],
): Promise<{ variant_id: string; qty: number }[]> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
    const user = await getSessionUser();
    if (!user) return [];
    // `reservations` não tem leitura pública: service_role, com o dono vindo
    // da SESSÃO (nunca do navegador).
    const admin = createAdminClient();
    const { data } = await admin
      .from("reservations")
      .select("variant_id, qty, orders!inner ( customer_id, payment_status )")
      .in("variant_id", variantIds)
      .eq("orders.customer_id", user.id)
      .eq("orders.payment_status", "pending");
    return (data ?? []).map((r) => ({
      variant_id: r.variant_id,
      qty: Number(r.qty) || 0,
    }));
  } catch {
    return [];
  }
}

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

/**
 * Cancela (e libera a reserva de) um pedido online que não chegou a ter link
 * de pagamento. O pedido é gravado ANTES do link, então qualquer saída de erro
 * depois disso deixaria um "pending" que ninguém consegue pagar — enche o
 * painel de pedido fantasma (foi o que aconteceu com os nº 1007, 1008 e 1010
 * enquanto o handle esteve inválido) e, pior, prende a peça reservada até a
 * expiração. Cancelar em vez de apagar: a tentativa frustrada é informação
 * útil para a loja.
 */
async function cancelaPedidoSemLink(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
): Promise<void> {
  // Sem devolver, a peça ficaria presa até a expiração por um pedido que
  // já nasceu morto — e a vitrine mostraria "esgotado" sem ninguém comprando.
  if (await cancelarPedidoPendente(admin, orderId))
    updateTag(CACHE_TAGS.catalogo); // a peça voltou para a prateleira
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

/**
 * Pedido pelo WhatsApp — o ÚNICO canal que esta action exportada grava.
 *
 * Os parâmetros de canal e entrega continuam na assinatura só para a sacola
 * compilar sem mudança, mas são IGNORADOS: server action é endpoint público, e
 * aceitar `"online"` daqui deixava um visitante sem login gravar pedido online
 * e RESERVAR estoque por 20 min, em laço, sem nunca pagar. Pedido online só
 * nasce por `startOnlinePaymentAction`, que exige login e endereço do próprio
 * cliente antes de chamar `criarPedido`.
 */
export async function createOrderAction(
  items: CheckoutItem[],
  _channel?: "whatsapp" | "online",
  _shipping?: {
    shippingMethod: "pickup" | "delivery";
    shippingAddress: Record<string, unknown> | null;
  },
  extras?: OrderExtras,
): Promise<CheckoutResult> {
  // Frete cotado na sacola: o pedido grava entrega + o CEP da cotação, para o
  // painel mostrar para onde é o frete que entrou no total (antes ficava só o
  // valor, sem destino). O endereço completo continua sendo combinado no
  // WhatsApp; o CEP é o que a sacola cotou, e o preço já foi recotado pelo
  // servidor com ele.
  const cep = String(extras?.freight?.cep ?? "").replace(/\D/g, "");
  const shipping =
    extras?.freight && cep.length === 8
      ? { shippingMethod: "delivery" as const, shippingAddress: { cep } }
      : undefined;
  return criarPedido(items, "whatsapp", shipping, extras);
}

/** Normaliza os itens vindos do navegador (quantidade inteira entre 1 e 99). */
function limparItens(items: CheckoutItem[]): CheckoutItem[] {
  return (
    (Array.isArray(items) ? items : [])
      .map((i) => {
        const price = Number(i?.price);
        return {
          variantId: String(i?.variantId ?? ""),
          qty: Math.max(1, Math.min(99, Math.floor(Number(i?.qty) || 0))),
          ...(Number.isFinite(price) && price > 0 ? { price } : {}),
        };
      })
      .filter((i) => i.variantId && i.qty > 0)
      // Mesmo teto da cotação e do saldo: evita um `IN` gigante vindo de payload
      // forjado.
      .slice(0, 50)
  );
}

type LinhaPedido = {
  variant_id: string;
  product_name: string;
  variant_label: string | null;
  unit_price: number;
  qty: number;
  weight_grams: number;
};

/** O pedido calculado no servidor, ainda sem gravar. */
type Rascunho = {
  rows: LinhaPedido[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  shippingCost: number;
  shippingService: string | null;
  /** Id do serviço no Melhor Envio (o nome muda; o id não) — é o que a
   * compra da etiqueta usa. */
  shippingServiceId: number | null;
  /** Prazo em dias úteis da opção escolhida (vira "chega até dd/mm"). */
  shippingDays: number | null;
  total: number;
};

async function criarPedido(
  items: CheckoutItem[],
  channel: "whatsapp" | "online",
  shipping?: {
    shippingMethod: "pickup" | "delivery";
    shippingAddress: Record<string, unknown> | null;
  },
  extras?: OrderExtras,
): Promise<CheckoutResult> {
  const clean = limparItens(items);
  if (clean.length === 0)
    return { ok: false, code: "items", error: "Sacola vazia." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return {
      ok: false,
      code: "config",
      error: "Loja indisponível no momento.",
    };

  const admin = createAdminClient();

  // Server Action é endpoint público e aqui o login é opcional: sem freio, o
  // mesmo payload válido pode ser reenviado em laço, enchendo `orders` e
  // gastando a cota do Resend — quando ela acaba, os avisos de pedido PAGO
  // param de sair em silêncio. O limite é por IP e generoso o bastante para
  // não pegar cliente indeciso.
  if (await excedeuLimite(admin)) {
    return {
      ok: false,
      code: "rate",
      error: "Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo.",
    };
  }

  const montado = await montarPedido(admin, clean, channel, extras);
  if (!montado.ok) return montado.res;
  const r = await gravarPedido(admin, montado.rascunho, channel, shipping);
  // O id interno do pedido não volta ao navegador — a tela só usa o número.
  return {
    ok: r.ok,
    error: r.error,
    code: r.code,
    orderNumber: r.orderNumber,
    totals: r.totals,
  };
}

/**
 * Calcula o pedido SEM gravar: relê preço e nome pela variante, valida o
 * cupom e recota o frete. Separado da gravação para o pagamento online poder
 * comparar com um pedido pendente ANTES de decidir se cria outro.
 *
 * Não confere estoque: no "pagar de novo" a peça está reservada para o
 * próprio pedido pendente do cliente, e a conferência daria "esgotado" para
 * ele mesmo. Quem confere é `gravarPedido`.
 */
async function montarPedido(
  admin: ReturnType<typeof createAdminClient>,
  clean: CheckoutItem[],
  channel: "whatsapp" | "online",
  extras?: OrderExtras,
): Promise<
  { ok: true; rascunho: Rascunho } | { ok: false; res: CheckoutResult }
> {
  const falha = (res: CheckoutResult) => ({ ok: false as const, res });

  const { data, error } = await admin
    .from("product_variants")
    .select(
      "id, size, color, products ( name, active_ecommerce, price, promo_price, weight_grams, category_name )",
    )
    .in(
      "id",
      clean.map((i) => i.variantId),
    );
  if (error || !data)
    return falha({
      ok: false,
      code: "payment",
      error: "Erro ao montar o pedido.",
    });

  const byId = new Map(
    (data as unknown as VariantRow[]).map((v) => [v.id, v] as const),
  );

  const rows: LinhaPedido[] = [];
  // Peça que saiu da loja (apagada, desativada ou sem preço) RECUSA o pedido,
  // dizendo qual. Antes ela era pulada em silêncio — o cliente pagava sem ela
  // e a sacola era limpa ao confirmar — ou, se só estava desativada, era
  // vendida e reservada como se ainda estivesse à venda.
  const fora: string[] = [];
  const nomesFora: string[] = [];
  // Preço que SUBIU desde que a peça entrou na sacola: recusa e devolve o
  // preço atual, igual ao frete (`expectedPrice`). Cobrar R$ 259 de quem viu
  // R$ 199 é a surpresa que faz o cliente desistir — ou reclamar depois.
  const precos: Record<string, number> = {};
  const subiram: string[] = [];

  for (const item of clean) {
    const v = byId.get(item.variantId);
    const price = !v?.products
      ? NaN
      : v.products.promo_price != null && Number(v.products.promo_price) > 0
        ? Number(v.products.promo_price)
        : Number(v.products.price ?? 0);
    if (
      !v?.products ||
      !v.products.active_ecommerce ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      fora.push(item.variantId);
      if (v?.products?.name) nomesFora.push(v.products.name);
      continue;
    }
    if (item.price != null && price > item.price + 0.005) {
      precos[v.id] = price;
      subiram.push(
        `${v.products.name} passou de ${formatBRL(item.price)} para ${formatBRL(price)}`,
      );
    }

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

  if (fora.length > 0)
    return falha({
      ok: false,
      code: "items",
      fora,
      error:
        nomesFora.length > 0
          ? `Não está mais à venda: ${nomesFora.map(displayProductName).join(", ")}. Tire da sacola para continuar.`
          : "Uma peça da sacola não está mais à venda. Tire-a para continuar.",
    });
  if (subiram.length > 0)
    return falha({
      ok: false,
      code: "price_changed",
      precos,
      error: `O preço mudou: ${subiram.join("; ")}. A sacola já foi atualizada — confira e toque em pagar de novo.`,
    });
  if (rows.length === 0)
    return falha({
      ok: false,
      code: "items",
      error: "Os itens da sacola não estão mais à venda.",
    });

  const subtotal = rows.reduce((s, r) => s + r.unit_price * r.qty, 0);

  // Cupom: validado AGORA, contra o subtotal relido — o que a sacola mostrou
  // é cortesia. Cupom inválido barra o pedido em vez de seguir sem desconto:
  // cobrar mais do que a tela prometeu é pior do que pedir para tentar de novo.
  let discount = 0;
  let couponCode: string | null = null;
  if (extras?.couponCode) {
    const c = await checkCoupon(admin, extras.couponCode, subtotal);
    if (!c.ok)
      return falha({ ok: false, code: "coupon", error: `Cupom: ${c.error}` });
    discount = c.discount;
    couponCode = c.code;
  }

  // Frete: RECOTADO no servidor pelo CEP + serviço escolhido. O preço que veio
  // da sacola morre aqui — localStorage não decide dinheiro.
  let shippingCost = 0;
  let shippingService: string | null = null;
  let shippingServiceId: number | null = null;
  let shippingDays: number | null = null;
  if (extras?.freight) {
    const quote = await quoteShipping({
      cepDestino: extras.freight.cep,
      desconto: discount,
      itens: rows.map((r) => ({
        weightGrams: r.weight_grams,
        price: r.unit_price,
        qty: r.qty,
      })),
    });
    if (!quote)
      return falha({
        ok: false,
        code: "freight_down",
        error:
          "A cotação de frete está fora do ar — tente de novo em instantes.",
      });
    const opt = quote.options.find(
      (o) => o.serviceId === extras.freight!.serviceId,
    );
    if (!opt)
      return falha({
        ok: false,
        code: "freight_changed",
        error: "O frete mudou — recalcule na sacola antes de finalizar.",
      });
    // O preço exibido vem como REFERÊNCIA (nunca como fonte): se a recotação
    // ficou MAIS CARA que o que a tela prometeu, recusa em vez de cobrar a
    // diferença em silêncio. Mais barato/igual segue.
    if (
      extras.freight.expectedPrice != null &&
      opt.price > extras.freight.expectedPrice + 0.005
    )
      return falha({
        ok: false,
        code: "freight_changed",
        error: "O frete mudou — recalcule na sacola antes de finalizar.",
      });
    shippingCost = opt.price;
    shippingService = `${opt.name}${opt.company ? ` (${opt.company})` : ""}`;
    shippingServiceId = opt.serviceId;
    shippingDays = opt.days > 0 ? Math.min(opt.days, 365) : null;
  }

  const total = Math.max(0, subtotal - discount + shippingCost);

  // A InfinitePay recusa cobrança abaixo de R$ 1,00 com um 422 GENÉRICO (o
  // mesmo de handle inválido) — sem esta guarda, um cupom generoso num item
  // barato criaria pedido cancelado fantasma com erro indiagnosticável.
  if (channel === "online" && total < 1)
    return falha({
      ok: false,
      code: "min_total",
      error: "O valor mínimo para pagamento online é R$ 1,00.",
    });

  return {
    ok: true,
    rascunho: {
      rows,
      subtotal,
      discount,
      couponCode,
      shippingCost,
      shippingService,
      shippingServiceId,
      shippingDays,
      total,
    },
  };
}

/**
 * Grava o pedido calculado por `montarPedido`: confere o estoque, insere
 * `orders`/`order_items`, reserva (online) e avisa (WhatsApp). Devolve também
 * o `orderId`, que só circula no servidor.
 */
async function gravarPedido(
  admin: ReturnType<typeof createAdminClient>,
  rascunho: Rascunho,
  channel: "whatsapp" | "online",
  shipping?: {
    shippingMethod: "pickup" | "delivery";
    shippingAddress: Record<string, unknown> | null;
  },
): Promise<CheckoutResult & { orderId?: string }> {
  const {
    rows,
    subtotal,
    discount,
    couponCode,
    shippingCost,
    shippingService,
    shippingServiceId,
    shippingDays,
    total,
  } = rascunho;

  const user = await getSessionUser(); // pedido de visitante fica sem cliente

  // WhatsApp de cliente logado que tem pagamento online pendente com as MESMAS
  // peças: a reserva dele prenderia a peça contra ele mesmo (a sacola, que
  // soma a reserva própria de volta, diria "disponível" e o servidor
  // recusaria). Ele mudou de caminho; o pendente online sai antes da
  // conferência. Só os pendentes que disputam alguma variante deste pedido —
  // um pagamento online de OUTRAS peças, aberto noutra aba, segue vivo.
  // (O online não passa aqui com pendentes: `startOnlinePaymentAction` já os
  // reaproveitou ou cancelou.)
  if (channel === "whatsapp" && user) {
    const variantes = new Set(rows.map((r) => r.variant_id));
    const disputam = (await pendentesOnline(admin, user.id)).filter((p) =>
      (p.order_items ?? []).some((i) => variantes.has(i.variant_id)),
    );
    await cancelarPendentes(admin, disputam);
  }

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
    return {
      ok: false,
      code: "stock",
      error: `Estoque insuficiente — ${detalhe}.`,
    };
  }

  // A FK de `orders.customer_id` aponta para `customers`, e a linha só nasce
  // na primeira visita à conta: logado sem ela (entrou e foi direto comprar)
  // falharia ao gravar. Pelo admin, porque o pedido também é gravado por ele.
  if (user)
    await admin
      .from("customers")
      .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

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
      shipping_service_id: shippingServiceId,
      shipping_days: shippingDays,
      total,
      channel,
      shipping_method: shipping?.shippingMethod ?? null,
      shipping_address: (shipping?.shippingAddress ?? null) as never,
    })
    .select("id, number")
    .single();
  if (orderErr || !order)
    return {
      ok: false,
      code: "payment",
      error: "Não foi possível registrar o pedido.",
    };

  const { error: itemsErr } = await admin.from("order_items").insert(
    // o peso serve só para a cotação — não é coluna de order_items
    rows.map(({ weight_grams: _peso, ...r }) => ({ ...r, order_id: order.id })),
  );
  if (itemsErr) {
    // Sem itens o pedido é lixo: desfaz para não sujar o histórico/admin.
    await admin.from("orders").delete().eq("id", order.id);
    return {
      ok: false,
      code: "payment",
      error: "Não foi possível registrar os itens.",
    };
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
        code: "stock",
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
    orderId: order.id,
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
