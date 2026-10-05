import type { Metadata } from "next";
import { requireCustomer } from "@/lib/customer";
import { getCustomerOrders } from "../order-data";
import { OrdersView } from "./orders-view";

export const metadata: Metadata = { title: "Meus pedidos" };

export default async function PedidosPage() {
  const user = await requireCustomer("/conta/pedidos");
  // Client com cookie: o RLS (own_orders_select) limita aos próprios pedidos.
  const orders = await getCustomerOrders(user.id);
  return <OrdersView orders={orders} />;
}
