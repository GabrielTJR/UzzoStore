import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session";

/**
 * Favoritos do cliente. Sem service_role: o RLS da tabela `wishlist`
 * (migração 0009) já limita cada um aos próprios registros.
 */

/** Ids dos produtos favoritados (vazio se não estiver logado). */
export const getWishlistIds = cache(async (): Promise<Set<string>> => {
  const user = await getSessionUser();
  if (!user) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wishlist")
    .select("product_id")
    .eq("customer_id", user.id);
  if (error || !data) return new Set();
  return new Set(data.map((r) => r.product_id));
});
