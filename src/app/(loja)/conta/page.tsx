import type { Metadata } from "next";
import {
  requireCustomer,
  getCustomerProfile,
  getCustomerAddresses,
} from "@/lib/customer";
import { getWishlistIds } from "@/lib/wishlist";
import { getCustomerOrders } from "./order-data";
import { ResumoView } from "./resumo-view";

export const metadata: Metadata = { title: "Minha conta" };

/** Quantos pedidos o resumo lê: o bastante para achar os em andamento sem
 * trazer o histórico inteiro (a lista completa é /conta/pedidos). */
const PEDIDOS_NO_RESUMO = 5;

export default async function ContaPage() {
  const user = await requireCustomer();
  // Tudo com o client de cookie (RLS) e em paralelo; dado de sessão, nada
  // disso pode ir para cache público.
  const [profile, orders, addresses, favoritos] = await Promise.all([
    getCustomerProfile(),
    getCustomerOrders(user.id, PEDIDOS_NO_RESUMO),
    getCustomerAddresses(),
    getWishlistIds(),
  ]);
  if (!profile) return null;

  return (
    <ResumoView
      profile={profile}
      orders={orders}
      addresses={addresses}
      favoritos={favoritos.size}
    />
  );
}
