/**
 * Configuração de frete — módulo NEUTRO (client e server importam).
 *
 * FRETE_GRATIS_MIN: subtotal a partir do qual o frete mais barato sai grátis
 * (a barra de progresso da sacola usa este número, e o SERVIDOR aplica o
 * desconto de verdade na cotação — os dois lados leem daqui, nunca divergem).
 * `null` desliga a promoção. ⚠️ Valor é decisão do dono — ajuste aqui.
 */
export const FRETE_GRATIS_MIN: number | null = 299;

/**
 * Peso padrão por categoria (em GRAMAS) quando o produto não tem
 * `weight_grams` cadastrado. Chutes conservadores para roupa embalada —
 * peso a MENOS gera cobrança por divergência depois (a reclamação nº 1
 * contra as plataformas de frete), então na dúvida arredondamos para cima.
 */
const PESO_POR_CATEGORIA: [RegExp, number][] = [
  [/camiseta|polo|regata/i, 350],
  [/camisa/i, 400],
  [/bermuda|shorts/i, 450],
  [/cal[cç]a/i, 650],
  [/moletom|sueter|su[eé]ter|tricot/i, 700],
  [/jaqueta|casaco|corta[- ]?vento|puffer|bomber/i, 900],
  [/sapato|t[eê]nis|cal[cç]ado/i, 1100],
  [/cueca|meia|kit|acess/i, 300],
];
const PESO_PADRAO = 500;

export function pesoPadraoGramas(categoryName: string | null): number {
  if (categoryName) {
    for (const [re, g] of PESO_POR_CATEGORIA)
      if (re.test(categoryName)) return g;
  }
  return PESO_PADRAO;
}

/**
 * Caixa da encomenda a partir do nº de peças: base 36×27 cm e altura que
 * cresce com o volume (roupa comprime). Dimensões mínimas dos Correios
 * respeitadas; altura teto de 30 cm.
 */
export function caixaParaPecas(qtd: number): {
  width: number;
  height: number;
  length: number;
} {
  const altura = Math.min(30, Math.max(4, 4 + (qtd - 1) * 3));
  return { width: 27, height: altura, length: 36 };
}
