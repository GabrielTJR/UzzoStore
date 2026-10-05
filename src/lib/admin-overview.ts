import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAdminProducts,
  LOW_STOCK_TOTAL,
  type AdminProductListItem,
} from "@/lib/admin-products";
import { getAdminOrders, type AdminOrder } from "@/lib/admin-orders";

/**
 * Pendências do dia para a Visão geral do painel: o que a loja precisa FAZER,
 * não um relatório. Cada número leva à tela onde se resolve.
 *
 * Só service_role, só chamado atrás de `requireAdmin()`. Roda quando um admin
 * abre a Visão geral — não é leitura por visita da loja. São três contagens
 * (`head: true`, sem trazer linha), os 6 pedidos mais recentes e a lista de
 * produtos que o painel já usa.
 */
export type AdminOverview = {
  pedidosNovos: number;
  /** Pagos e ainda não despachados/entregues para retirada. */
  aPreparar: number;
  aguardandoPagamento: number;
  estoqueBaixo: number;
  esgotados: number;
  semFoto: number;
  produtosAtivos: number;
  recentes: AdminOrder[];
};

/** Produto ATIVO com saldo total entre 1 e o limite de "baixo". */
export function isLowStock(p: AdminProductListItem): boolean {
  return p.active && p.stock > 0 && p.stock <= LOW_STOCK_TOTAL;
}

/** Produto ATIVO sem nenhuma unidade. */
export function isSoldOut(p: AdminProductListItem): boolean {
  return p.active && p.variants > 0 && p.stock <= 0;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const admin = createAdminClient();
  const conta = (q: PromiseLike<{ count: number | null }>) =>
    Promise.resolve(q).then((r) => r.count ?? 0);

  const [pedidosNovos, aPreparar, aguardandoPagamento, recentes, produtos] =
    await Promise.all([
      conta(
        admin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .is("seen_at", null),
      ),
      conta(
        admin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("payment_status", "paid")
          .in("fulfillment_status", ["pending", "preparing"]),
      ),
      conta(
        admin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("payment_status", "pending")
          .neq("fulfillment_status", "canceled"),
      ),
      getAdminOrders(6),
      getAdminProducts(),
    ]);

  return {
    pedidosNovos,
    aPreparar,
    aguardandoPagamento,
    estoqueBaixo: produtos.filter(isLowStock).length,
    esgotados: produtos.filter(isSoldOut).length,
    semFoto: produtos.filter((p) => p.active && p.images === 0).length,
    produtosAtivos: produtos.filter((p) => p.active).length,
    recentes,
  };
}
