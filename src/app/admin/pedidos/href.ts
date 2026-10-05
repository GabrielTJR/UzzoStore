/**
 * Endereço da tela de pedidos — módulo NEUTRO (sem import de servidor).
 *
 * A tela tem dois estados que vivem na URL: a vista (`?vista=lista`; o quadro
 * é o padrão e não leva parâmetro) e o pedido aberto no modal
 * (`?pedido=<número>`). Montar na mão em cada lugar é como um deles acaba
 * derrubando o outro: abrir um pedido a partir da lista voltaria para o
 * quadro, e fechar o modal trocaria a vista de quem estava na lista.
 */
export function pedidosHref(vista: "quadro" | "lista", pedido?: number): string {
  const q = new URLSearchParams();
  if (vista === "lista") q.set("vista", "lista");
  if (pedido !== undefined) q.set("pedido", String(pedido));
  const query = q.toString();
  return query ? `/admin/pedidos?${query}` : "/admin/pedidos";
}
