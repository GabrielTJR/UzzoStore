import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session";
import type { User } from "@supabase/supabase-js";

export type AdminRecord = {
  role: "owner" | "admin";
  full_name: string | null;
  must_change_password: boolean;
};

/** E-mails autorizados a acessar o /admin (env ADMIN_EMAILS, separados por vírgula). */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Retorna o usuário logado se ele for admin; caso contrário, null.
 *
 * Embrulhado em `cache()` (memoização por REQUISIÇÃO do React): o layout e a
 * página chamam isso na mesma renderização, e sem o cache seriam 2 idas ao
 * Supabase Auth + 2 chamadas de `is_admin()` a cada navegação — o que deixava
 * cada clique de filtro visivelmente lento para quem está logado no admin.
 */
export const getAdminUser = cache(async (): Promise<User | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  // Fonte da verdade: tabela public.admins via is_admin(). O allowlist por env
  // (ADMIN_EMAILS) fica só como rede de segurança de bootstrap.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin) return user;
  if (user.email && adminEmails().includes(user.email.toLowerCase())) {
    return user;
  }
  return null;
});

/**
 * Usuário logado + registro em public.admins (papel, nome, flag de 1º acesso).
 * Também memoizado por requisição (o guard de página e a UI podem chamar juntos).
 */
export const getAdminRecord = cache(async (): Promise<{
  user: User;
  record: AdminRecord;
} | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data } = await supabase
    .from("admins")
    .select("role, full_name, must_change_password")
    .eq("user_id", user.id)
    .maybeSingle();

  if (data) return { user, record: data as AdminRecord };

  // Fallback de bootstrap: admin por ADMIN_EMAILS ainda sem linha em admins.
  if (user.email && adminEmails().includes(user.email.toLowerCase())) {
    return {
      user,
      record: { role: "admin", full_name: null, must_change_password: false },
    };
  }
  return null;
});

/**
 * Guard de página: exige admin. Redireciona para /admin/login se não for admin,
 * ou para /admin/definir-senha se estiver no primeiro acesso (troca obrigatória).
 */
export async function requireAdmin(): Promise<User> {
  const res = await getAdminRecord();
  if (!res) redirect("/admin/login");
  if (res.record.must_change_password) redirect("/admin/definir-senha");
  return res.user;
}

/** Gera um slug amigável a partir de um texto. */
export function slugify(text: string): string {
  const diacritics = new RegExp("[\\u0300-\\u036f]", "g");
  return text
    .normalize("NFD")
    .replace(diacritics, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
