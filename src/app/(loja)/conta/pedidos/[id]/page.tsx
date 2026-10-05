import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/customer";
import { getCustomerOrder } from "../../order-data";
import { OrderDetailView } from "./order-detail-view";

export const metadata: Metadata = { title: "Detalhes do pedido" };

export default async function PedidoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireCustomer("/conta/pedidos");
  const { id } = await params;
  // RLS (own_orders_select) já limita ao dono; o filtro por customer_id em
  // `getCustomerOrder` é defesa em profundidade.
  const order = await getCustomerOrder(user.id, id);
  if (!order) notFound();
  return <OrderDetailView order={order} />;
}
