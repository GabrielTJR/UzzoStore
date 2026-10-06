"use server";

import { getAdminUser } from "@/lib/admin";
import { getSessionUser } from "@/lib/session";
import { getWishlistIds } from "@/lib/wishlist";

/**
 * O "quem é" da vitrine (`lib/viewer.ts`): logado, admin e favoritos, numa
 * chamada só. O navegador chama UMA vez por carregamento de página e só quando
 * tem cookie de sessão — então isto custa por visita de LOGADO, não por visita.
 * Sem sessão, responde vazio sem consultar nada além do cookie.
 */
export async function viewerAction(): Promise<{
  logged: boolean;
  admin: boolean;
  favorites: string[];
}> {
  const user = await getSessionUser();
  if (!user) return { logged: false, admin: false, favorites: [] };
  const [admin, favorites] = await Promise.all([
    getAdminUser(),
    getWishlistIds(),
  ]);
  return { logged: true, admin: !!admin, favorites: [...favorites] };
}
