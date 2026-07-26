import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuditRow = {
  id: number;
  created_at: string;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  metadata: unknown;
  ip: string | null;
};

/** Lê o audit_log via service_role (guardar por getAdminUser na página). */
export async function getAuditLog(
  opts: { action?: string; limit?: number } = {},
): Promise<AuditRow[]> {
  const admin = createAdminClient();
  let query = admin
    .from("audit_log")
    .select(
      "id, created_at, actor_email, action, entity_type, entity_id, entity_label, metadata, ip",
    )
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.action) query = query.eq("action", opts.action);

  const { data, error } = await query;
  if (error || !data) return [];
  return data as unknown as AuditRow[];
}

/** Ações distintas presentes no log (para o filtro). */
export async function getAuditActions(): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("audit_log").select("action").limit(2000);
  return Array.from(new Set((data ?? []).map((r) => r.action))).sort();
}
