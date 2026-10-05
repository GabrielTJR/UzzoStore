import type { Metadata } from "next";
import { requireCustomer } from "@/lib/customer";
import { getWishlistIds } from "@/lib/wishlist";
import { getProducts } from "@/lib/products";
import { FavoritesView } from "./favorites-view";

export const metadata: Metadata = { title: "Meus favoritos" };

export default async function FavoritosPage() {
  await requireCustomer("/conta/favoritos");
  const ids = await getWishlistIds();
  // Sem favorito não há o que buscar: pula a consulta do catálogo.
  const items = ids.size
    ? (await getProducts({ productIds: [...ids], page: 1, perPage: 48 })).items
    : [];
  return <FavoritesView items={items} />;
}
