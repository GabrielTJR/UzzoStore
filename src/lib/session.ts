import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Usuário da sessão (cliente OU admin), memoizado por requisição.
 *
 * Ponto único para `auth.getUser()`: o layout, o guard de admin e a área do
 * cliente precisam do mesmo dado na mesma renderização — sem isso seriam
 * várias idas ao Supabase Auth por navegação.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
});
