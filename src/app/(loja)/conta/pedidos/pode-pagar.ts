/**
 * Folga mínima, em minutos, para (re)abrir o pagamento de um pedido pendente.
 *
 * Com menos que isto o pagamento chegaria depois da expiração: o pg_cron
 * devolve a peça à prateleira e o `confirmPayment` tem de separá-la de novo —
 * ou o pedido fica pago sem peça. Vale para o checkout (reaproveitar o
 * pendente) E para o "Pagar agora" de Meus pedidos: abaixo dela, o pendente é
 * cancelado e o cliente monta um pedido novo, com a janela cheia.
 *
 * Módulo neutro (sem "use client" nem imports de servidor): o botão, as
 * páginas e as actions leem o MESMO número.
 */
export const REUSO_MIN_RESTANTE_MIN = 3;

/** Ainda há folga para pagar este pedido? */
export function temFolgaParaPagar(expiresAt: string, agora: number): boolean {
  return Date.parse(expiresAt) - agora >= REUSO_MIN_RESTANTE_MIN * 60_000;
}

/**
 * O pedido ganha "Pagar agora"? Online, aguardando pagamento e com prazo de
 * reserva. As páginas de servidor chamam isto.
 *
 * O prazo em si NÃO é conferido aqui (seria `Date.now()` no render): o botão
 * só aparece depois de montar, e só com a folga acima; quem decide de verdade
 * é `payPendingOrderAction`, no servidor.
 */
export function podePagarAgora(o: {
  channel: string;
  payment_status: string;
  fulfillment_status: string;
  expires_at: string | null;
}): o is typeof o & { expires_at: string } {
  return (
    o.channel === "online" &&
    o.payment_status === "pending" &&
    o.fulfillment_status !== "canceled" &&
    o.expires_at != null
  );
}
