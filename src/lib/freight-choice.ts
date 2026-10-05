import type { ShippingOption } from "@/lib/shipping";

/**
 * Qual opção de frete já vem marcada — fonte ÚNICA para a sacola e o checkout.
 * Módulo neutro (só `import type`): roda no navegador. Se cada tela tivesse a
 * sua cópia, bastaria mexer numa para o cliente ver uma opção marcada na
 * sacola e outra no checkout, para o mesmo CEP.
 *
 * Sem frete grátis: a MAIS BARATA. Marcar uma paga por padrão cobraria do
 * cliente uma escolha que ele não fez.
 *
 * Com frete grátis: a loja cobre até a opção recomendada, então várias saem por
 * R$ 0 — entre elas, a que chega ANTES é estritamente melhor para quem compra e
 * não custa nada a mais para a loja. As pagas ("Outros fretes") nunca vêm
 * marcadas: cobrar por velocidade tem que ser escolha ativa.
 */
export function freteRecomendado(
  options: ShippingOption[],
  freeApplied: boolean,
): ShippingOption | null {
  if (options.length === 0) return null;
  if (freeApplied) {
    const livres = options.filter((o) => o.free);
    if (livres.length > 0)
      return livres.reduce((a, b) => (b.days < a.days ? b : a));
  }
  return options[0]; // a lista já vem com a mais barata primeiro
}
