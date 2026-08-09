"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/session";
import { getAdminUser } from "@/lib/admin";
import {
  createPaymentLink,
  infinitepayHandle,
  toCents,
} from "@/lib/infinitepay";

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
};

type VariantRow = {
  id: string;
  size: string | null;
  color: string | null;
  products: {
    name: string;
    price: number | null;
    promo_price: number | null;
  } | null;
};

/**
 * Pagamento online: exige login (a loja quis identificar quem paga pelo site),
 * registra o pedido e devolve a URL do checkout da InfinitePay.
 * Só os produtos são cobrados — frete é combinado depois no WhatsApp.
 */
export async function startOnlinePaymentAction(
  items: CheckoutItem[],
): Promise<{ ok: boolean; url?: string; error?: string; needsLogin?: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, needsLogin: true, error: "Entre para pagar." };
  if (!infinitepayHandle())
    return { ok: false, error: "Pagamento online ainda não está configurado." };

  const order = await createOrderAction(items, "online");
  if (!order.ok || !order.orderNumber)
    return { ok: false, error: order.error ?? "Erro ao criar o pedido." };

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("order_items")
    .select("product_name, variant_label, unit_price, qty, orders!inner ( number )")
    .eq("orders.number", order.orderNumber);

  const items_ = (rows ?? []).map((r) => ({
    quantity: r.qty,
    price: toCents(Number(r.unit_price)),
    description: [r.product_name, r.variant_label].filter(Boolean).join(" — "),
  }));
  if (items_.length === 0) return { ok: false, error: "Pedido vazio." };

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
  });
  if (!link.ok || !link.url) {
    // Para o admin, mostra a resposta crua da InfinitePay — sem isso a tela só
    // diz "erro" e não dá para descobrir o que o provedor recusou.
    const admin = await getAdminUser();
    return {
      ok: false,
      error:
        admin && link.detail
          ? `${link.error ?? "Erro ao gerar o pagamento."} [${link.detail}]`
          : (link.error ?? "Erro ao gerar o pagamento."),
    };
  }

  return { ok: true, url: link.url };
}

/** Base pública do site (a InfinitePay precisa de URLs absolutas). */
function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : "https://uzzostore.com.br";
}

export async function createOrderAction(
  items: CheckoutItem[],
  channel: "whatsapp" | "online" = "whatsapp",
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
  const { data, error } = await admin
    .from("product_variants")
    .select("id, size, color, products ( name, price, promo_price )")
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
    });
  }

  if (rows.length === 0)
    return { ok: false, error: "Os itens da sacola não estão mais à venda." };

  const subtotal = rows.reduce((s, r) => s + r.unit_price * r.qty, 0);
  const user = await getSessionUser(); // pedido de visitante fica sem cliente

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      customer_id: user?.id ?? null,
      status: "pending",
      payment_status: "pending",
      subtotal,
      total: subtotal, // frete é combinado no WhatsApp por enquanto
      channel,
    })
    .select("id, number")
    .single();
  if (orderErr || !order)
    return { ok: false, error: "Não foi possível registrar o pedido." };

  const { error: itemsErr } = await admin
    .from("order_items")
    .insert(rows.map((r) => ({ ...r, order_id: order.id })));
  if (itemsErr) {
    // Sem itens o pedido é lixo: desfaz para não sujar o histórico/admin.
    await admin.from("orders").delete().eq("id", order.id);
    return { ok: false, error: "Não foi possível registrar os itens." };
  }

  return { ok: true, orderNumber: order.number };
}
