"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session";

export type WishlistResult = { ok: boolean; favorite: boolean; error?: string };

/**
 * Liga/desliga o favorito de um produto. Escreve com o client do usuário —
 * o RLS (`own_wishlist_all`) garante que ninguém mexe na lista de outro.
 */
export async function toggleWishlistAction(
  productId: string,
  favorite: boolean,
): Promise<WishlistResult> {
  const user = await getSessionUser();
  if (!user)
    return { ok: false, favorite: false, error: "Entre na sua conta." };
  const id = String(productId ?? "");
  if (!id) return { ok: false, favorite: false, error: "Produto inválido." };

  const supabase = await createClient();

  // A linha em `customers` pode não existir ainda (é criada na 1ª visita à
  // conta) e a FK da wishlist aponta para ela.
  await supabase
    .from("customers")
    .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

  const { error } = favorite
    ? await supabase
        .from("wishlist")
        .upsert(
          { customer_id: user.id, product_id: id },
          { onConflict: "customer_id,product_id", ignoreDuplicates: true },
        )
    : await supabase
        .from("wishlist")
        .delete()
        .eq("customer_id", user.id)
        .eq("product_id", id);

  if (error)
    return {
      ok: false,
      favorite: !favorite,
      error: "Não foi possível atualizar os favoritos.",
    };

  revalidatePath("/conta/favoritos");
  return { ok: true, favorite };
}
