/**
 * Parcelamento exibido na vitrine. Módulo NEUTRO (sem imports de servidor):
 * é usado em client components.
 *
 * ⚠️ Este número é uma PROMESSA e o site não o controla. A API de link da
 * InfinitePay não aceita parâmetro de parcelas — quem manda é a configuração
 * da conta, no painel deles. Se a conta mudar, o site passa a mentir sem
 * ninguém tocar em código: ao mexer no painel, confira aqui também.
 *
 * Estado confirmado em 23/08/2026: o dono configurou a conta para ABSORVER a
 * taxa em até 3x, e o resumo do checkout passou a mostrar "Taxas R$ 0,00" num
 * pedido de R$ 300,00 — antes o mesmo teste somava acréscimo em todas as
 * opções (1x de um pedido de R$ 359,80 saía R$ 375,58). Por isso o "sem juros"
 * vale SÓ até 3x: acima disso a taxa volta a ser repassada.
 */
const MAX_PARCELAS: number | null = 3;

/** Até onde vale o "sem juros" (igual a MAX_PARCELAS enquanto forem o mesmo). */
export const PARCELAS_SEM_JUROS = 3;

/**
 * Piso da parcela, para não sair "3x de R$ 3,33" numa peça barata. Baixo de
 * propósito: com o catálogo entre R$ 143 e R$ 359, um piso de R$ 100 esconderia
 * o 3x justamente das peças em que ele mais convence.
 */
const PARCELA_MINIMA = 30;

export type Installments = {
  count: number;
  value: number;
  /**
   * Se ESTE parcelamento é sem juros. Vem calculado em vez de escrito à mão
   * nas telas: se um dia o teto subir para 12, o rótulo some sozinho acima de
   * `PARCELAS_SEM_JUROS`, em vez de continuar prometendo o que a conta não faz.
   */
  semJuros: boolean;
};

/** Maior nº de parcelas que podemos AFIRMAR para o preço (null = não afirmar). */
export function installmentsFor(price: number | null): Installments | null {
  if (MAX_PARCELAS == null) return null;
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  const count = Math.min(MAX_PARCELAS, Math.floor(price / PARCELA_MINIMA));
  if (count < 2) return null; // à vista: não vale a linha extra
  return {
    count,
    value: price / count,
    semJuros: count <= PARCELAS_SEM_JUROS,
  };
}
