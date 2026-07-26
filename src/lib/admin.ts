import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/** E-mails autorizados a acessar o /admin (env ADMIN_EMAILS, separados por vírgula). */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Retorna o usuário logado se ele for admin; caso contrário, null. */
export async function getAdminUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // Fonte da verdade: tabela public.admins via is_admin(). O allowlist por env
  // (ADMIN_EMAILS) fica só como rede de segurança de bootstrap.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin) return user;
  if (user.email && adminEmails().includes(user.email.toLowerCase())) {
    return user;
  }
  return null;
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
