"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

/**
 * "Avise-me quando chegar": guarda o e-mail do interessado numa variante
 * esgotada. O disparo acontece quando o admin repõe o estoque
 * (`saveVariantAction` em admin/actions.ts). Público → valida variante no
 * banco, deduplica por unique(variant_id,email) e freia por IP.
 */
export async function createStockAlertAction(
  variantId: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const clean = String(email ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
  const vid = String(variantId ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean))
    return { ok: false, error: "Informe um e-mail válido." };
  if (!vid) return { ok: false, error: "Variante inválida." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return { ok: false, error: "Tente novamente mais tarde." };

  const admin = createAdminClient();
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
    if (ip) {
      const desde = new Date(Date.now() - 10 * 60_000).toISOString();
      const { count } = await admin
        .from("audit_log")
        .select("id", { count: "exact", head: true })
        .eq("action", "stock_alert.create")
        .eq("ip", ip)
        .gte("created_at", desde);
      if ((count ?? 0) >= 10)
        return { ok: false, error: "Muitas tentativas. Aguarde um pouco." };
    }
  } catch {
    /* freio falha aberto */
  }

  // A variante precisa existir (e é o que amarra o alerta ao produto certo).
  const { data: variant } = await admin
    .from("product_variants")
    .select("id")
    .eq("id", vid)
    .maybeSingle();
  if (!variant) return { ok: false, error: "Produto não encontrado." };

  const { error } = await admin
    .from("stock_alerts")
    .upsert(
      { variant_id: vid, email: clean, notified_at: null },
      { onConflict: "variant_id,email" },
    );
  if (error) return { ok: false, error: "Não foi possível salvar." };

  await logAudit(null, {
    action: "stock_alert.create",
    entityType: "stock_alert",
    entityLabel: clean,
    metadata: { variant_id: vid },
  });
  return { ok: true };
}
