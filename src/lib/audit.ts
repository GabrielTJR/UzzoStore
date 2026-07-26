import "server-only";
import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

export type AuditEntry = {
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Registra uma ação do admin no audit_log. Best-effort: uma falha de log
 * NUNCA quebra a operação. O ator (quem) só é conhecido nesta camada, porque
 * as escritas usam service_role (que não carrega o JWT do usuário).
 */
export async function logAudit(
  actor: User | null,
  entry: AuditEntry,
): Promise<void> {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;
    const userAgent = h.get("user-agent");
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      actor_id: actor?.id ?? null,
      actor_email: actor?.email ?? null,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      entity_label: entry.entityLabel ?? null,
      metadata: (entry.metadata ?? {}) as unknown as Json,
      ip,
      user_agent: userAgent,
    });
  } catch {
    // best-effort — silencioso de propósito
  }
}
