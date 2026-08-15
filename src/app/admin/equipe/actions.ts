"use server";

import { revalidatePath } from "next/cache";
import { getAdminRecord } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "../actions";

/**
 * Adiciona um admin. Cria o usuário no Auth (com senha provisória) — ou usa um
 * já existente — e o insere em public.admins. Novos usuários entram com
 * must_change_password = true (trocam a senha no 1º acesso).
 */
export async function addAdminAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await getAdminRecord();
  if (!res || res.record.role !== "owner") {
    return { ok: false, error: "Apenas o owner pode adicionar admins." };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const tempPassword = String(formData.get("tempPassword") ?? "");
  if (!email) return { ok: false, error: "Informe o e-mail." };
  if (tempPassword.length < 8) {
    return {
      ok: false,
      error: "A senha provisória deve ter ao menos 8 caracteres.",
    };
  }

  const admin = createAdminClient();

  let userId: string | null = null;
  let isNew = false;
  const created = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: name },
    app_metadata: { staff: true },
  });
  if (created.data?.user) {
    userId = created.data.user.id;
    isNew = true;
  } else {
    // E-mail já existe no Auth → localiza o usuário para promover a admin.
    const { data } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const existing = (data?.users ?? []).find(
      (u) => u.email?.toLowerCase() === email,
    );
    if (!existing) {
      return {
        ok: false,
        error: created.error?.message ?? "Não foi possível criar o usuário.",
      };
    }
    userId = existing.id;
  }

  // Não sobrescrever um admin existente (evitaria rebaixar owner / apagar dados).
  const { data: existingAdmin } = await admin
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingAdmin) {
    return { ok: false, error: "Este usuário já é admin." };
  }
  const { error: insErr } = await admin.from("admins").insert({
    user_id: userId,
    full_name: name || null,
    role: "admin",
    must_change_password: isNew,
  });
  if (insErr) return { ok: false, error: "Erro ao adicionar o admin." };

  await logAudit(res.user, {
    action: "admin.invite",
    entityType: "admin",
    entityId: userId,
    entityLabel: email,
    metadata: { email, name, created: isNew },
  });
  revalidatePath("/admin/equipe");
  return { ok: true };
}

/** Remove um admin (apenas owner; nunca a si mesmo nem o último admin). */
export async function removeAdminAction(formData: FormData): Promise<void> {
  const res = await getAdminRecord();
  if (!res || res.record.role !== "owner") return;

  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === res.user.id) return;

  const admin = createAdminClient();
  // Não remove owners (proteção no servidor, não só na UI).
  const { data: target } = await admin
    .from("admins")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!target || target.role === "owner") return;

  const { count } = await admin
    .from("admins")
    .select("*", { count: "exact", head: true });
  if ((count ?? 0) <= 1) return;

  await admin.from("admins").delete().eq("user_id", userId);
  await logAudit(res.user, {
    action: "admin.remove",
    entityType: "admin",
    entityId: userId,
  });
  revalidatePath("/admin/equipe");
}
