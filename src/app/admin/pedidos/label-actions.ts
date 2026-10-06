"use server";

import { revalidatePath } from "next/cache";
import { getAdminFor } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { pesoDaPeca } from "@/lib/shipping";
import { caixaParaPecas } from "@/lib/shipping-config";
import {
  comprarEtiqueta,
  linkEtiqueta,
  prepararEtiqueta,
  rastreioDe,
  removerDoCarrinho,
} from "@/lib/melhorenvio-label";

/**
 * Etiqueta do Melhor Envio pelo painel. Três ações, todas re-verificam a
 * permissão (server action é endpoint público):
 *  - `prepararEtiquetaAction`: chave da NF-e → carrinho do Melhor Envio →
 *    devolve o preço real. NÃO cobra.
 *  - `comprarEtiquetaAction`: paga com a carteira, gera o PDF, grava link e
 *    rastreio no pedido.
 *  - `atualizarEtiquetaAction`: gera de novo / busca o rastreio depois.
 *
 * `orders.label_url` guarda o estado: null (nada), "comprando" (trava contra
 * clique duplo), "paga" (paga, PDF ainda não gerado) ou o link https do PDF.
 */

type Res = { ok: boolean; error?: string; price?: number };

const SELECT = `id, number, customer_id, payment_status, fulfillment_status,
  shipping_method, shipping_address, shipping_service, shipping_service_id,
  melhorenvio_id, label_url, tracking_code, discount,
  customers ( full_name, phone, cpf ),
  order_items ( product_name, qty, unit_price,
    product_variants ( products ( weight_grams, category_name ) ) )`;

type Pedido = {
  id: string;
  number: number;
  customer_id: string | null;
  payment_status: string;
  fulfillment_status: string;
  shipping_method: string | null;
  shipping_address: Record<string, string | null> | null;
  shipping_service: string | null;
  shipping_service_id: number | null;
  melhorenvio_id: string | null;
  label_url: string | null;
  tracking_code: string | null;
  discount: number | null;
  customers: { full_name: string | null; phone: string | null; cpf: string | null } | null;
  order_items: {
    product_name: string;
    qty: number;
    unit_price: number;
    product_variants: {
      products: { weight_grams: number | null; category_name: string | null } | null;
    } | null;
  }[];
};

async function lerPedido(orderId: string): Promise<Pedido | null> {
  const { data } = await createAdminClient()
    .from("orders")
    .select(SELECT)
    .eq("id", orderId)
    .maybeSingle();
  return (data as unknown as Pedido) ?? null;
}

function revalida() {
  revalidatePath("/admin/pedidos");
  revalidatePath("/conta/pedidos");
}

export async function prepararEtiquetaAction(
  orderId: string,
  nfeKeyRaw: string,
): Promise<Res> {
  const actor = await getAdminFor("pedidos");
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const nfeKey = String(nfeKeyRaw ?? "").replace(/\D/g, "");
  if (nfeKey.length !== 44)
    return {
      ok: false,
      error: "A chave da NF-e tem 44 números (está no DANFE, abaixo do código de barras).",
    };

  const p = await lerPedido(String(orderId ?? ""));
  if (!p) return { ok: false, error: "Pedido não encontrado." };
  if (p.shipping_method !== "delivery")
    return { ok: false, error: "Este pedido é de retirada na loja." };
  if (p.payment_status !== "paid")
    return { ok: false, error: "A etiqueta só sai para pedido pago." };
  if (p.label_url)
    return { ok: false, error: "Este pedido já tem etiqueta comprada." };
  if (!p.shipping_service_id)
    return {
      ok: false,
      error:
        "O pedido não guardou o serviço de frete escolhido (pedido anterior a 06/10). Compre esta pelo painel do Melhor Envio.",
    };

  const end = p.shipping_address ?? {};
  const c = p.customers;
  if (!end.cep || !end.street || !end.city || !end.state)
    return { ok: false, error: "O pedido não tem endereço completo." };
  if (!c?.full_name || !c.cpf || !c.phone)
    return { ok: false, error: "Faltam nome, CPF ou telefone do cliente." };

  let email: string | null = null;
  if (p.customer_id) {
    const { data } = await createAdminClient().auth.admin.getUserById(
      p.customer_id,
    );
    email = data.user?.email ?? null;
  }

  const qtd = p.order_items.reduce((s, i) => s + i.qty, 0);
  const pesoKg =
    p.order_items.reduce(
      (s, i) =>
        s +
        pesoDaPeca(
          i.product_variants?.products?.weight_grams ?? null,
          i.product_variants?.products?.category_name ?? null,
        ) *
          i.qty,
      0,
    ) / 1000;
  const mercadoria = p.order_items.reduce((s, i) => s + i.unit_price * i.qty, 0);
  const box = caixaParaPecas(qtd);

  // Preparado antes e não comprado: tira o antigo do carrinho deles.
  if (p.melhorenvio_id) await removerDoCarrinho(p.melhorenvio_id);

  const r = await prepararEtiqueta(
    {
      serviceId: p.shipping_service_id,
      nfeKey,
      numeroPedido: p.number,
      destinatario: {
        name: c.full_name,
        phone: c.phone,
        email,
        cpf: c.cpf,
        street: end.street,
        number: end.number ?? "",
        complement: end.complement ?? null,
        district: end.district ?? "",
        city: end.city,
        state: end.state,
        cep: end.cep,
      },
      itens: p.order_items.map((i) => ({
        name: i.product_name,
        qty: i.qty,
        unitPrice: i.unit_price,
      })),
      volume: { ...box, weightKg: pesoKg },
      valorSegurado: Math.max(1, mercadoria - Number(p.discount ?? 0)),
    },
    p.shipping_service,
  );

  if (!r.ok) {
    await logAudit(actor, {
      action: "shipping.label_failed",
      entityType: "order",
      entityId: p.id,
      metadata: { number: p.number, etapa: "carrinho", error: r.error },
    });
    return { ok: false, error: r.error };
  }

  await createAdminClient()
    .from("orders")
    .update({ melhorenvio_id: r.data.id, updated_at: new Date().toISOString() })
    .eq("id", p.id);
  await logAudit(actor, {
    action: "shipping.label_cart",
    entityType: "order",
    entityId: p.id,
    metadata: { number: p.number, price: r.data.price, nfe: nfeKey },
  });
  revalida();
  return { ok: true, price: r.data.price };
}

export async function comprarEtiquetaAction(orderId: string): Promise<Res> {
  const actor = await getAdminFor("pedidos");
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const admin = createAdminClient();
  // Trava: só um clique compra. O UPDATE condicional decide quem segue.
  const { data: travado } = await admin
    .from("orders")
    .update({ label_url: "comprando" })
    .eq("id", String(orderId ?? ""))
    .eq("payment_status", "paid")
    .is("label_url", null)
    .not("melhorenvio_id", "is", null)
    .select("id, number, melhorenvio_id, tracking_code")
    .maybeSingle();
  if (!travado?.melhorenvio_id)
    return { ok: false, error: "Prepare a etiqueta antes (ou ela já foi comprada)." };

  const r = await comprarEtiqueta(travado.melhorenvio_id);
  if (!r.ok) {
    // Pagou mas não gerou → "paga" (o botão "Gerar de novo" termina).
    // Não pagou → volta a null, dá para tentar de novo.
    const pagou = r.error.startsWith("A etiqueta foi PAGA");
    await admin
      .from("orders")
      .update({ label_url: pagou ? "paga" : null })
      .eq("id", travado.id);
    await logAudit(actor, {
      action: "shipping.label_failed",
      entityType: "order",
      entityId: travado.id,
      metadata: { number: travado.number, etapa: "compra", error: r.error },
    });
    revalida();
    return { ok: false, error: r.error };
  }

  await admin
    .from("orders")
    .update({
      label_url: r.data.labelUrl,
      ...(r.data.tracking && !travado.tracking_code
        ? { tracking_code: r.data.tracking }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", travado.id);
  await logAudit(actor, {
    action: "shipping.label_bought",
    entityType: "order",
    entityId: travado.id,
    metadata: { number: travado.number, tracking: r.data.tracking },
  });
  revalida();
  return { ok: true };
}

/** Gera de novo (etiqueta paga sem PDF) e/ou busca o rastreio. */
export async function atualizarEtiquetaAction(orderId: string): Promise<Res> {
  const actor = await getAdminFor("pedidos");
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const p = await lerPedido(String(orderId ?? ""));
  if (!p?.melhorenvio_id || !p.label_url)
    return { ok: false, error: "Este pedido não tem etiqueta comprada." };

  const admin = createAdminClient();
  if (!p.label_url.startsWith("https://")) {
    const r = await linkEtiqueta(p.melhorenvio_id);
    if (!r.ok) return { ok: false, error: r.error };
    await admin
      .from("orders")
      .update({
        label_url: r.data.labelUrl,
        ...(r.data.tracking && !p.tracking_code
          ? { tracking_code: r.data.tracking }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id);
  } else if (!p.tracking_code) {
    const t = await rastreioDe(p.melhorenvio_id);
    if (!t)
      return {
        ok: false,
        error: "A transportadora ainda não informou o rastreio. Costuma sair depois da postagem.",
      };
    await admin
      .from("orders")
      .update({ tracking_code: t, updated_at: new Date().toISOString() })
      .eq("id", p.id);
  }
  revalida();
  return { ok: true };
}
