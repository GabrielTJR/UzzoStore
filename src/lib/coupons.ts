import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/session";

/**
 * Validação de cupom — SEMPRE no servidor, com service_role (a tabela não tem
 * policy pública de propósito: SELECT aberto deixaria enumerar códigos).
 * O desconto devolvido é recalculado na criação do pedido; o que a UI mostra
 * é cortesia, nunca fonte de verdade.
 */
export type CouponCheck =
  | { ok: true; code: string; percentOff: number; discount: number }
  | {
      ok: false;
      error: string;
      /** Recusa do FREIO, não do cupom: a tela mantém o cupom aplicado (o
       * pedido revalida de qualquer jeito) em vez de apagá-lo como inválido. */
      rateLimited?: boolean;
    };

export async function checkCoupon(
  admin: ReturnType<typeof createAdminClient>,
  rawCode: string,
  subtotal: number,
): Promise<CouponCheck> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Informe o código." };

  // `*` e não a lista de colunas: `uma_por_cliente` nasce na migração 0025, e
  // pedir uma coluna que ainda não existe derrubaria a validação de TODO cupom.
  const { data: row, error } = await admin
    .from("coupons")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  const data = row as
    (NonNullable<typeof row> & { uma_por_cliente?: boolean }) | null;

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

  // Uma vez por cliente (BEMVINDO10, migração 0025): precisa saber QUEM é, e
  // conta os pedidos dele com o código que já gastaram o cupom — pagos, ou de
  // WhatsApp não cancelados (lá o uso conta na criação). Pendente não conta:
  // quem volta da InfinitePay sem pagar pode tentar de novo.
  if (data.uma_por_cliente) {
    const user = await getSessionUser();
    if (!user)
      return {
        ok: false,
        error:
          "Entre na sua conta para usar este cupom (vale uma vez por cliente).",
      };
    const { count } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", user.id)
      .eq("coupon_code", code)
      .or(
        "payment_status.eq.paid,and(channel.eq.whatsapp,fulfillment_status.neq.canceled)",
      );
    if ((count ?? 0) > 0)
      return { ok: false, error: "Você já usou este cupom." };
  }

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
