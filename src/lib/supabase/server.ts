import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Cliente Supabase para uso no SERVIDOR (Server Components, Route Handlers).
 * Usa a anon key + cookies da sessão; o acesso continua sob RLS.
 * Para operações privilegiadas (worker de sync, gravação server-side),
 * use um cliente separado com SUPABASE_SERVICE_ROLE_KEY — nunca aqui.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado a partir de um Server Component (cookies read-only).
            // O middleware é responsável por renovar a sessão.
          }
        },
      },
    },
  );
}
