"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

/**
 * Captura de e-mail do rodapé. Endpoint público: valida, deduplica pela PK e
 * tem freio por IP (mesma técnica do pedido — conta no audit_log) para não
 * virarem alvo de script as duas coisas: a tabela e a cota de auditoria.
 */
export async function subscribeNewsletterAction(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const clean = String(email ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean))
    return { ok: false, error: "Informe um e-mail válido." };
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
        .eq("action", "newsletter.subscribe")
        .eq("ip", ip)
        .gte("created_at", desde);
      if ((count ?? 0) >= 5)
        return { ok: false, error: "Muitas tentativas. Aguarde um pouco." };
    }
  } catch {
    // freio falha aberto — cadastro de e-mail não pode travar por causa dele
  }

  const { error } = await admin
    .from("newsletter_subscribers")
    .upsert({ email: clean, source: "rodape" }, { onConflict: "email" });
  if (error)
    return { ok: false, error: "Não foi possível salvar. Tente de novo." };

  await logAudit(null, {
    action: "newsletter.subscribe",
    entityType: "newsletter",
    entityLabel: clean,
  });
  return { ok: true };
}
