import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Validação de cupom — SEMPRE no servidor, com service_role (a tabela não tem
 * policy pública de propósito: SELECT aberto deixaria enumerar códigos).
 * O desconto devolvido é recalculado na criação do pedido; o que a UI mostra
 * é cortesia, nunca fonte de verdade.
 */
export type CouponCheck =
  | { ok: true; code: string; percentOff: number; discount: number }
  | { ok: false; error: string };

export async function checkCoupon(
  admin: ReturnType<typeof createAdminClient>,
  rawCode: string,
  subtotal: number,
): Promise<CouponCheck> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Informe o código." };

  const { data, error } = await admin
    .from("coupons")
    .select(
      "code, percent_off, min_subtotal, active, max_uses, used_count, expires_at",
    )
    .eq("code", code)
    .maybeSingle();

  // Mensagem ÚNICA para não-existe/inativo/expirado/esgotado: mensagens
  // distintas viram oráculo de enumeração (confirmam que o código existe).
  const generico = "Cupom inválido ou expirado.";
  if (error || !data) return { ok: false, error: generico };
  if (!data.active) return { ok: false, error: generico };
  if (data.expires_at && new Date(data.expires_at) < new Date())
    return { ok: false, error: generico };
  if (data.max_uses != null && data.used_count >= data.max_uses)
    return { ok: false, error: generico };
  if (subtotal < Number(data.min_subtotal))
    return {
      ok: false,
      error: `Este cupom vale para compras a partir de R$ ${Number(
        data.min_subtotal,
      ).toFixed(2)}.`,
    };

  const percentOff = Number(data.percent_off);
  // Centavos sempre para BAIXO no desconto — arredondar para cima cobraria
  // um centavo a menos do total e quebraria a conferência do pagamento.
  const discount = Math.floor(subtotal * percentOff) / 100;
  return { ok: true, code, percentOff, discount };
}

/** Consome 1 uso (chamar só depois de o pedido ser gravado). */
export async function consumeCoupon(
  admin: ReturnType<typeof createAdminClient>,
  code: string,
): Promise<void> {
  // Best-effort: contagem de uso é estatística, não trava de segurança.
  const { data } = await admin
    .from("coupons")
    .select("used_count")
    .eq("code", code)
    .maybeSingle();
  if (data)
    await admin
      .from("coupons")
      .update({ used_count: data.used_count + 1 })
      .eq("code", code);
}
