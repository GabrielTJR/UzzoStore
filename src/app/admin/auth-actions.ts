"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "./actions";

/**
 * Passo 1 do login (email-first): informa se o e-mail é de um admin que está
 * no PRIMEIRO acesso (precisa trocar a senha). Só expõe o flag mustChange.
 */
export async function checkAdminEmail(
  email: string,
): Promise<{ mustChange: boolean }> {
  const clean = email.trim().toLowerCase();
  if (!clean || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { mustChange: false };
  }
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = (data?.users ?? []).find(
    (u) => u.email?.toLowerCase() === clean,
  );
  if (!user) return { mustChange: false };
  const { data: row } = await admin
    .from("admins")
    .select("must_change_password")
    .eq("user_id", user.id)
    .maybeSingle();
  return { mustChange: !!row?.must_change_password };
}

/**
 * Altera a senha do usuário logado (server-side) e SÓ então limpa o flag de 1º
 * acesso. Os dois passos ficam juntos e no servidor para não dar como cumprida
 * a troca obrigatória sem uma senha nova de fato ter sido definida.
 */
export async function changePassword(
  newPassword: string,
): Promise<ActionResult> {
  if (newPassword.length < 8) {
    return { ok: false, error: "A senha deve ter ao menos 8 caracteres." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre novamente." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: "Não foi possível definir a senha." };

  const admin = createAdminClient();
  await admin
    .from("admins")
    .update({ must_change_password: false })
    .eq("user_id", user.id);
  await logAudit(user, {
    action: "admin.password_change",
    entityType: "admin",
    entityId: user.id,
  });
  return { ok: true };
}

/** Registra o login do admin no audit_log (chamado após signIn no client). */
export async function recordLogin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return;
  await logAudit(user, {
    action: "auth.login",
    entityType: "admin",
    entityId: user.id,
  });
}

/** Admin altera o próprio nome. */
export async function updateOwnNameAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autorizado." };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { ok: false, error: "Não autorizado." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Informe o nome." };

  const admin = createAdminClient();
  await admin.from("admins").update({ full_name: name }).eq("user_id", user.id);
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { full_name: name },
  });
  await logAudit(user, {
    action: "admin.update_name",
    entityType: "admin",
    entityId: user.id,
    metadata: { name },
  });
  return { ok: true };
}

/** Admin altera a própria senha. */
export async function changeOwnPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return changePassword(String(formData.get("password") ?? ""));
}
