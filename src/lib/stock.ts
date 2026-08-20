import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Movimentação de estoque num lugar só.
 *
 * Regra do fluxo: a peça sai do estoque quando o pedido é COMPROMETIDO, não
 * quando o dinheiro entra.
 *   online   — sai na criação do pedido, com reserva de 20 min; volta se o
 *              pagamento não vier (o pg_cron cuida, migração 0018)
 *   whatsapp — sai quando o admin confirma o pagamento na mão, porque ali o
 *              dinheiro entra fora do sistema e não há prazo para esperar
 *
 * Antes disso o estoque só saía na confirmação, e dois clientes conseguiam
 * pagar a MESMA última peça: o decrement_stock impedia saldo negativo, não o
 * segundo pagamento.
 */

export type ItemEstoque = {
  variant_id: string;
  qty: number;
  product_name?: string;
  variant_label?: string | null;
};

function rotulo(i: ItemEstoque): string {
  return [i.product_name, i.variant_label].filter(Boolean).join(" — ");
}

/**
 * Tira as peças do estoque. Devolve os itens que NÃO couberam (vazio = tudo
 * certo). Quem decide é o banco: a condição de saldo vai dentro do UPDATE
 * (`decrement_stock`, migração 0012), então dois pedidos simultâneos não levam
 * a mesma peça.
 */
export async function baixarEstoque(
  admin: Admin,
  itens: ItemEstoque[],
): Promise<string[]> {
  const semSaldo: string[] = [];
  const baixados: ItemEstoque[] = [];

  for (const it of itens) {
    const { data: restante, error } = await admin.rpc("decrement_stock", {
      p_variant_id: it.variant_id,
      p_qty: it.qty,
    });
    if (error || restante === -1 || restante === null) {
      semSaldo.push(rotulo(it));
      continue;
    }
    baixados.push(it);
  }

  // Tudo ou nada: um pedido com metade das peças reservadas prenderia estoque
  // sem poder ser vendido, e ainda mostraria "esgotado" para quem chegasse.
  if (semSaldo.length > 0 && baixados.length > 0) {
    await devolverEstoque(admin, baixados);
  }
  return semSaldo;
}

/** Devolve as peças ao estoque (expiração, cancelamento, estorno). */
export async function devolverEstoque(
  admin: Admin,
  itens: ItemEstoque[],
): Promise<void> {
  for (const it of itens) {
    await admin.rpc("increment_stock", {
      p_variant_id: it.variant_id,
      p_qty: it.qty,
    });
  }
}

/** Os itens do pedido, no formato que as funções acima esperam. */
export async function itensDoPedido(
  admin: Admin,
  orderId: string,
): Promise<ItemEstoque[]> {
  const { data } = await admin
    .from("order_items")
    .select("variant_id, qty, product_name, variant_label")
    .eq("order_id", orderId);
  return (data ?? []) as ItemEstoque[];
}

/**
 * Baixa o estoque E marca a reserva do pedido online. Devolve o que faltou; se
 * faltou alguma coisa, nada é reservado (o `baixarEstoque` já desfez).
 */
export async function reservarParaPedido(
  admin: Admin,
  orderId: string,
  itens: ItemEstoque[],
  expiresAt: string,
): Promise<string[]> {
  const semSaldo = await baixarEstoque(admin, itens);
  if (semSaldo.length > 0) return semSaldo;

  await admin.from("reservations").insert(
    itens.map((i) => ({
      order_id: orderId,
      variant_id: i.variant_id,
      qty: i.qty,
      expires_at: expiresAt,
    })),
  );

  // Marca de EXIBIÇÃO na linha de estoque que a vitrine já lê: sem isto o
  // tamanho apareceria como "esgotado", que é mentira enquanto alguém está
  // pagando por ele. A verdade da reserva continua em `reservations`.
  await marcarReserva(admin, itens, expiresAt);
  return [];
}

/**
 * O pagamento entrou: a peça saiu de vez. Só apaga a reserva — o estoque já
 * tinha sido baixado na criação, e baixar de novo venderia duas vezes.
 */
export async function consumirReserva(
  admin: Admin,
  orderId: string,
): Promise<void> {
  const { data: reservas } = await admin
    .from("reservations")
    .select("variant_id")
    .eq("order_id", orderId);
  await admin.from("reservations").delete().eq("order_id", orderId);
  // Vendida de vez: não está mais "em processo de compra".
  await marcarReserva(
    admin,
    (reservas ?? []).map((r) => ({ variant_id: r.variant_id, qty: 0 })),
    null,
  );
}

/**
 * Cancelou antes de pagar: devolve o estoque e apaga a reserva.
 *
 * Guiado pelas linhas de `reservations`, NÃO pelos itens do pedido: só volta o
 * que de fato saiu. Pedido de WhatsApp não tem reserva, então isto é no-op ali
 * — e é o que se quer, porque lá a baixa acontece noutro momento.
 */
export async function liberarReserva(
  admin: Admin,
  orderId: string,
): Promise<void> {
  const { data: reservas } = await admin
    .from("reservations")
    .select("variant_id, qty")
    .eq("order_id", orderId);
  if (!reservas || reservas.length === 0) return;

  await devolverEstoque(admin, reservas as ItemEstoque[]);
  await admin.from("reservations").delete().eq("order_id", orderId);
  await marcarReserva(admin, reservas as ItemEstoque[], null);
}

/** Liga/desliga o aviso de compra em curso na linha de estoque. */
async function marcarReserva(
  admin: Admin,
  itens: { variant_id: string }[],
  ate: string | null,
): Promise<void> {
  if (itens.length === 0) return;
  await admin
    .from("stock_cache")
    .update({ reservado_ate: ate })
    .eq("deposito_id", "loja")
    .in(
      "variant_id",
      itens.map((i) => i.variant_id),
    );
}
