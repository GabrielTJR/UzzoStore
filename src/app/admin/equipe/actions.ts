"use server";

import { revalidatePath } from "next/cache";
import { getAdminRecord } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { CARGOS, CARGOS_ATRIBUIVEIS, type AdminRole } from "@/lib/admin-roles";
import type { ActionResult } from "../actions";

/** Cargo vindo de formulário: só os que o dono pode dar (nunca "owner"). */
function cargoDoForm(v: FormDataEntryValue | null): AdminRole | null {
  const r = String(v ?? "");
  return (CARGOS_ATRIBUIVEIS as string[]).includes(r) ? (r as AdminRole) : null;
}

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
    return { ok: false, error: "Só o dono adiciona pessoas à equipe." };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const tempPassword = String(formData.get("tempPassword") ?? "");
  const role = cargoDoForm(formData.get("role"));
  if (!email) return { ok: false, error: "Informe o e-mail." };
  if (!role) return { ok: false, error: "Escolha o cargo." };
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
    return { ok: false, error: "Essa pessoa já está na equipe." };
  }
  // Conta que já existia (um cliente, por exemplo): a senha provisória que o
  // dono digitou passa a valer, e a troca no 1º acesso também. Antes ela era
  // descartada em silêncio, e o dono entregava uma senha que não funcionava.
  // DEPOIS da conferência acima de propósito: quem já é da equipe (o próprio
  // dono, inclusive) nunca tem a senha trocada por aqui.
  if (!isNew) {
    const { error: pwErr } = await admin.auth.admin.updateUserById(userId!, {
      password: tempPassword,
    });
    if (pwErr)
      return {
        ok: false,
        error: "Não foi possível definir a senha provisória.",
      };
  }
  const { error: insErr } = await admin.from("admins").insert({
    user_id: userId,
    full_name: name || null,
    role,
    must_change_password: true,
  });
  if (insErr) return { ok: false, error: "Erro ao adicionar à equipe." };

  await logAudit(res.user, {
    action: "admin.invite",
    entityType: "admin",
    entityId: userId,
    entityLabel: email,
    metadata: { email, name, created: isNew, role },
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
    .select("role, full_name")
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
    entityLabel: target.full_name ?? undefined,
  });
  revalidatePath("/admin/equipe");
}

/**
 * Troca o cargo de alguém (só o dono). Nunca mexe num dono nem em si mesmo, e
 * o cargo novo passa pela lista fechada — "owner" não se dá pelo painel.
 */
export async function setAdminRoleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await getAdminRecord();
  if (!res || res.record.role !== "owner")
    return { ok: false, error: "Só o dono muda cargos." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const userId = String(formData.get("userId") ?? "");
  const role = cargoDoForm(formData.get("role"));
  if (!userId || !role) return { ok: false, error: "Cargo inválido." };
  if (userId === res.user.id)
    return { ok: false, error: "Você não pode mudar o próprio cargo." };

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("admins")
    .select("role, full_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!target) return { ok: false, error: "Pessoa não encontrada." };
  if (target.role === "owner")
    return { ok: false, error: "O cargo do dono não muda pelo painel." };
  if (target.role === role) return { ok: true };

  const { error } = await admin
    .from("admins")
    .update({ role })
    .eq("user_id", userId);
  if (error) {
    // Sem a migração 0024 o banco recusa "vendedor" (valor fora do enum).
    return {
      ok: false,
      error:
        role === "vendedor"
          ? "O banco ainda não conhece o cargo Vendedor — aplique a migração 0024 no Supabase."
          : "Não foi possível mudar o cargo.",
    };
  }

  await logAudit(res.user, {
    action: "admin.role_change",
    entityType: "admin",
    entityId: userId,
    entityLabel: target.full_name ?? undefined,
    metadata: { from: target.role, to: role, cargo: CARGOS[role].nome },
  });
  revalidatePath("/admin/equipe");
  return { ok: true };
}

/**
 * Nova senha provisória (só o dono, nunca para um dono). Serve para quem
 * perdeu a senha provisória ou esqueceu a própria: a pessoa entra com ela e é
 * obrigada a definir outra no primeiro acesso, como num convite novo.
 */
export async function resetTempPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await getAdminRecord();
  if (!res || res.record.role !== "owner")
    return { ok: false, error: "Só o dono gera senha provisória." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const userId = String(formData.get("userId") ?? "");
  const tempPassword = String(formData.get("tempPassword") ?? "");
  if (!userId || userId === res.user.id)
    return { ok: false, error: "Pessoa inválida." };
  if (tempPassword.length < 8)
    return {
      ok: false,
      error: "A senha provisória deve ter ao menos 8 caracteres.",
    };

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("admins")
    .select("role, full_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!target || target.role === "owner")
    return { ok: false, error: "Pessoa inválida." };

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });
  if (error) return { ok: false, error: "Não foi possível trocar a senha." };
  await admin
    .from("admins")
    .update({ must_change_password: true })
    .eq("user_id", userId);

  // A senha NÃO vai para o log — só o fato.
  await logAudit(res.user, {
    action: "admin.temp_password",
    entityType: "admin",
    entityId: userId,
    entityLabel: target.full_name ?? undefined,
  });
  revalidatePath("/admin/equipe");
  return { ok: true };
}
