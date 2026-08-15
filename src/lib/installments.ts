/**
 * Parcelamento exibido na vitrine — regra da casa: até 3x, com parcela mínima
 * de R$ 100. Módulo NEUTRO (sem imports de servidor): é usado em client
 * components.
 *
 * ⚠️ Isto é só EXIBIÇÃO. Quem parcela de verdade é a tela da InfinitePay, e o
 * número de parcelas/juros efetivos vem da configuração da conta lá — a API de
 * link não aceita parâmetro de parcelas. Por isso o texto diz "em até 3x" sem
 * prometer "sem juros" (só prometa depois de confirmar a conta com o suporte
 * da InfinitePay).
 */
const MAX_PARCELAS = 3;
const PARCELA_MINIMA = 100;

export type Installments = { count: number; value: number };

/** Maior nº de parcelas permitido para o preço (1 = à vista). */
export function installmentsFor(price: number | null): Installments | null {
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  const count = Math.min(MAX_PARCELAS, Math.floor(price / PARCELA_MINIMA));
  if (count < 2) return null; // à vista: não vale a linha extra
  return { count, value: price / count };
}
