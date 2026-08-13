import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Cliente Supabase para leituras PÚBLICAS do catálogo (vitrine, home, produto).
 *
 * Diferente de `./server`, este NÃO lê cookies — e é exatamente por isso que
 * existe: dentro de `unstable_cache` não é permitido tocar em cookies/headers,
 * e sem cache toda visita repetia as mesmas consultas (foi assim que o egress
 * do Supabase estourou). Continua sob RLS com a anon key: só lê o que já é
 * público para qualquer visitante.
 *
 * Nunca use para dados de sessão (pedidos, favoritos, conta) — sem cookies não
 * há usuário, e o resultado seria cacheado entre pessoas diferentes.
 */
let client: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createPublicClient() {
  client ??= createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return client;
}
