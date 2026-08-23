/**
 * Parcelamento exibido na vitrine. Módulo NEUTRO (sem imports de servidor):
 * é usado em client components.
 *
 * ⚠️ NÃO controlamos este número. A API de link da InfinitePay não aceita
 * parâmetro de parcelas — quem manda é a configuração da conta, no painel
 * deles. O site chegou a anunciar "em até 3x" sem base nenhuma, e provavelmente
 * anunciando MENOS do que o cliente encontrava no checkout.
 *
 * Por isso o padrão é `null` = não afirmamos nada. Enquanto estiver assim, a
 * vitrine simplesmente não mostra linha de parcela (os três pontos de exibição
 * já testam `parcelas &&`): melhor calar do que prometer número que pode mudar
 * no painel sem ninguém tocar em código.
 *
 * Para voltar a exibir, confirme na tela de PAGAMENTO de um link real quantas
 * parcelas o cartão oferece e ponha esse número em `MAX_PARCELAS`. Só escreva
 * "sem juros" depois de confirmar com o suporte como a conta está configurada:
 * juro existindo e o site dizendo que não há vira briga na hora de pagar.
 *
 * Confirmado em 23/08/2026, olhando o checkout da conta: os meios são Pix e
 * CRÉDITO. Débito não existe nesse caminho — é exclusivo da maquininha.
 */
const MAX_PARCELAS: number | null = null;

/** Piso da parcela, para não sair "12x de R$ 8". Só vale com MAX_PARCELAS. */
const PARCELA_MINIMA = 100;

export type Installments = { count: number; value: number };

/** Maior nº de parcelas que podemos AFIRMAR para o preço (null = não afirmar). */
export function installmentsFor(price: number | null): Installments | null {
  if (MAX_PARCELAS == null) return null;
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  const count = Math.min(MAX_PARCELAS, Math.floor(price / PARCELA_MINIMA));
  if (count < 2) return null; // à vista: não vale a linha extra
  return { count, value: price / count };
}
