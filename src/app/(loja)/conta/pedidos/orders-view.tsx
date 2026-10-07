import type { AccountOrder } from "../order-data";
import { AccountHeading } from "../account-shell";
import { IconBox } from "@/components/icons";
import { EmptyState, OrderCard } from "./order-ui";

/** Pedido que ainda pede atenção (pagar, esperar, buscar) — sobe para o topo. */
export function emAndamento(o: AccountOrder): boolean {
  if (o.fulfillment_status === "done") return false;
  // Pago e cancelado = em revisão pela loja: ainda não acabou para o cliente.
  if (o.payment_status === "paid") return true;
  return o.payment_status === "pending" && o.fulfillment_status !== "canceled";
}

/**
 * Lista de pedidos. Separa "Em andamento" de "Anteriores": no celular o
 * cliente abre esta tela quase sempre para saber de UM pedido — o que ainda
 * não chegou —, e misturado aos antigos ele teria de procurar pela data.
 */
export function OrdersView({ orders }: { orders: AccountOrder[] }) {
  const abertos = orders.filter(emAndamento);
  const anteriores = orders.filter((o) => !emAndamento(o));

  return (
    <>
      <AccountHeading
        title="Pedidos"
        description="Acompanhe as compras feitas pelo site."
      />
      {orders.length === 0 ? (
        <EmptyState
          Icon={IconBox}
          title="Nenhum pedido ainda"
          text="Quando você comprar pelo site, o pedido aparece aqui com a situação de cada etapa."
        />
      ) : (
        <div className="space-y-10">
          {abertos.length > 0 && (
            <Grupo titulo="Em andamento" orders={abertos} />
          )}
          {anteriores.length > 0 && (
            <Grupo
              titulo={abertos.length ? "Anteriores" : "Seus pedidos"}
              orders={anteriores}
            />
          )}
        </div>
      )}
    </>
  );
}

function Grupo({ titulo, orders }: { titulo: string; orders: AccountOrder[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">{titulo}</h2>
      <div className="space-y-3">
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} />
        ))}
      </div>
    </section>
  );
}
