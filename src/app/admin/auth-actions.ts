"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { freiaIp } from "@/lib/rate-limit";
import type { ActionResult } from "./actions";

/** Consultas de "é primeiro acesso?" por IP na janela do freio (10 min). */
const LIMITE_CHECAGEM_EMAIL = 20;

/**
 * Passo 1 do login (email-first): informa se o e-mail é de um admin que está
 * no PRIMEIRO acesso (precisa trocar a senha). Só expõe o flag mustChange.
 *
 * É endpoint público (a tela de login não tem sessão). Por isso:
 * - freio por IP, como toda action pública que custa algo;
 * - parte da tabela `admins` filtrada por quem está no primeiro acesso (quase
 *   sempre zero ou uma linha) e confere o e-mail de cada um pelo id. Antes ela
 *   baixava a lista de TODOS os usuários do Auth — clientes inclusive — a cada
 *   chamada, e passando de 1000 usuários deixava de achar o admin.
 */
export async function checkAdminEmail(
  email: string,
): Promise<{ mustChange: boolean }> {
  const clean = String(email ?? "")
    .trim()
    .toLowerCase();
  if (!clean || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { mustChange: false };
  }
  // Freio estourado responde "não" — o login segue pela senha normal, e quem
  // está no primeiro acesso só precisa esperar alguns minutos.
  if (await freiaIp("admin.check_email", LIMITE_CHECAGEM_EMAIL))
    return { mustChange: false };

  const admin = createAdminClient();
  const { data: pendentes } = await admin
    .from("admins")
    .select("user_id")
    .eq("must_change_password", true)
    .limit(20);
  for (const p of pendentes ?? []) {
    const { data } = await admin.auth.admin.getUserById(p.user_id);
    if (data?.user?.email?.toLowerCase() === clean) return { mustChange: true };
  }
  return { mustChange: false };
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
