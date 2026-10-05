"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { freiaIp } from "@/lib/rate-limit";
import {
  quoteShipping,
  shippingConfigured,
  pesoDaPeca,
  type ShippingOption,
} from "@/lib/shipping";
import { checkCoupon, type CouponCheck } from "@/lib/coupons";

/**
 * Ações públicas da sacola: cotação de frete e validação de cupom.
 * Como toda server action, são endpoints públicos — nada aqui confia em
 * preço/peso vindo do navegador: tudo é relido do banco pela variante.
 */

export type QuoteResult =
  | { ok: true; options: ShippingOption[]; freeApplied: boolean }
  | { ok: false; unavailable?: boolean; error?: string };

type CartInput = { variantId: string; qty: number }[];

/** Relê as peças no banco: peso (cadastro ou padrão da categoria) + preço. */
async function readItems(items: CartInput) {
  const admin = createAdminClient();
  const clean = (Array.isArray(items) ? items : [])
    .map((i) => ({
      variantId: String(i?.variantId ?? ""),
      qty: Math.max(1, Math.min(99, Math.floor(Number(i?.qty) || 0))),
    }))
    .filter((i) => i.variantId && i.qty > 0)
    .slice(0, 50);
  if (clean.length === 0) return null;

  const { data, error } = await admin
    .from("product_variants")
    .select("id, products ( price, promo_price, weight_grams, category_name )")
    .in(
      "id",
      clean.map((i) => i.variantId),
    );
  if (error || !data) return null;

  type Row = {
    id: string;
    products: {
      price: number | null;
      promo_price: number | null;
      weight_grams: number | null;
      category_name: string | null;
    } | null;
  };
  const byId = new Map((data as unknown as Row[]).map((v) => [v.id, v]));
  const itens: { weightGrams: number; price: number; qty: number }[] = [];
  for (const c of clean) {
    const v = byId.get(c.variantId);
    if (!v?.products) continue;
    const price =
      v.products.promo_price != null && Number(v.products.promo_price) > 0
        ? Number(v.products.promo_price)
        : Number(v.products.price ?? 0);
    if (!Number.isFinite(price) || price <= 0) continue;
    itens.push({
      weightGrams: pesoDaPeca(
        v.products.weight_grams,
        v.products.category_name,
      ),
      price,
      qty: c.qty,
    });
  }
  return itens.length ? itens : null;
}

export async function quoteShippingAction(
  cep: string,
  items: CartInput,
): Promise<QuoteResult> {
  if (!shippingConfigured()) return { ok: false, unavailable: true };
  const cepLimpo = String(cep ?? "").replace(/\D/g, "");
  if (cepLimpo.length !== 8) return { ok: false, error: "CEP inválido." };

  // Cada CEP novo fura o cache e vira chamada externa: sem freio, um laço de
  // CEPs esgota o rate da conta no Melhor Envio e derruba a cotação de todos.
  if (await freiaIp("shipping.quote", 20))
    return { ok: false, error: "Muitas cotações seguidas. Aguarde um pouco." };

  const itens = await readItems(items);
  if (!itens)
    return { ok: false, error: "Sacola vazia ou itens indisponíveis." };

  const quote = await quoteShipping({ cepDestino: cepLimpo, itens });
  if (!quote)
    return { ok: false, error: "Não conseguimos cotar agora. Tente de novo." };
  return { ok: true, options: quote.options, freeApplied: quote.freeApplied };
}

export async function checkCouponAction(
  code: string,
  items: CartInput,
): Promise<CouponCheck> {
  // Sem freio isto vira oráculo de enumeração de cupom (2 queries por
  // tentativa). Uso legítimo é raríssimo: 10/10min sobra para gente de verdade.
  // `rateLimited` diz à tela que o "não" é do freio, não do cupom: ela mantém
  // o cupom aplicado em vez de apagá-lo como inválido (o pedido revalida).
  if (await freiaIp("coupon.check", 10))
    return {
      ok: false,
      error: "Muitas tentativas. Aguarde um pouco.",
      rateLimited: true,
    };

  const itens = await readItems(items);
  if (!itens) return { ok: false, error: "Sacola vazia." };
  const subtotal = itens.reduce((s, i) => s + i.price * i.qty, 0);
  return checkCoupon(createAdminClient(), String(code ?? ""), subtotal);
}
