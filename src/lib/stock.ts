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
  // Vendida de vez: não está mais "em processo de compra" — a não ser que
  // outro pedido ainda segure a mesma variante.
  await recalcularMarca(
    admin,
    (reservas ?? []).map((r) => r.variant_id),
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
  await recalcularMarca(
    admin,
    reservas.map((r) => r.variant_id),
  );
}

/**
 * Cancela um pedido AINDA NÃO PAGO e devolve a reserva dele. Devolve `true`
 * quando foi esta chamada que cancelou (quem chama então derruba a etiqueta
 * do catálogo — a peça voltou para a prateleira).
 *
 * A troca de situação vem PRIMEIRO e é condicional (`payment_status =
 * 'pending'` dentro do UPDATE): só quem vence a troca devolve o estoque. Na
 * ordem inversa, duas chamadas simultâneas (dois toques, duas abas) leriam as
 * mesmas linhas de `reservations` e devolveriam a peça duas vezes — estoque
 * fantasma, que é o oversell por outro caminho. Pedido pago ou já encerrado
 * (expirado pelo pg_cron, cancelado antes) fica intocado.
 */
export async function cancelarPedidoPendente(
  admin: Admin,
  orderId: string,
): Promise<boolean> {
  const { data: cancelado } = await admin
    .from("orders")
    .update({
      payment_status: "canceled",
      fulfillment_status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("payment_status", "pending")
    .select("id")
    .maybeSingle();
  if (!cancelado) return false;
  await liberarReserva(admin, orderId);
  return true;
}

/**
 * Recalcula o aviso de compra em curso das variantes depois que uma reserva
 * saiu: `max(expires_at)` das reservas que SOBRARAM, ou nulo se nenhuma.
 * Zerar direto apagaria o aviso de uma reserva viva de OUTRO cliente, e a
 * vitrine diria "esgotado" de uma peça que pode voltar em minutos. É a mesma
 * regra que o pg_cron aplica na expiração (migração 0021).
 */
async function recalcularMarca(
  admin: Admin,
  variantIds: string[],
): Promise<void> {
  const ids = [...new Set(variantIds)];
  if (ids.length === 0) return;
  const { data: restantes, error } = await admin
    .from("reservations")
    .select("variant_id, expires_at")
    .in("variant_id", ids);
  // Sem conseguir ler, não mexe: marca velha some sozinha na próxima passada
  // do cron; marca apagada por engano esconde reserva viva.
  if (error) return;

  const ate = new Map<string, string>();
  for (const r of restantes ?? []) {
    if (!r.variant_id || !r.expires_at) continue;
    const atual = ate.get(r.variant_id);
    if (!atual || Date.parse(r.expires_at) > Date.parse(atual))
      ate.set(r.variant_id, r.expires_at);
  }

  const semReserva = ids.filter((id) => !ate.has(id));
  if (semReserva.length > 0)
    await marcarReserva(
      admin,
      semReserva.map((variant_id) => ({ variant_id })),
      null,
    );
  for (const [variant_id, expira] of ate)
    await marcarReserva(admin, [{ variant_id }], expira);
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
