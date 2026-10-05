"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { freiaIp } from "@/lib/rate-limit";

/**
 * Diz se o e-mail já tem conta.
 *
 * Por padrão o Supabase esconde isso (responde "sucesso" no cadastro e não
 * envia nada), para ninguém descobrir quais e-mails são clientes da loja.
 * A loja preferiu avisar — é melhor de usar, ao custo de permitir descobrir
 * se um endereço tem cadastro.
 *
 * A consulta usa a função `email_exists` (migração 0010), que é SECURITY
 * DEFINER com EXECUTE revogado de anon/authenticated: só o service_role
 * chama, daqui. Nunca exponha isso como RPC pública — viraria um endpoint de
 * enumeração de e-mails.
 *
 * Esta action, porém, É endpoint público: sem freio, um script consultaria
 * uma lista inteira de e-mails. Acima do teto responde `false` ("não sei"),
 * que no cadastro só deixa seguir para o fluxo normal do Supabase — não
 * afirma nada nem trava quem é de verdade.
 */
export async function emailAlreadyRegistered(email: string): Promise<boolean> {
  const clean = String(email ?? "").trim();
  if (!clean || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  if (await freiaIp("auth.email_check", 10)) return false;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("email_exists", { p_email: clean });
  if (error) return false; // na dúvida, não afirma nada
  return data === true;
}
