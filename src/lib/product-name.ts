/**
 * Exibição do nome do produto — módulo NEUTRO (sem import de servidor).
 *
 * O cadastro mistura "POLO SOFT TECH" com "Camiseta Sorona Premium" (o ERP
 * grava em caixa alta; o que é digitado no admin, não). Numa grade de cards,
 * caixa alta parece grito e ocupa mais largura. Mesma ideia do `displayColor`.
 *
 * Só mexe em nome TODO em maiúsculas — nome com caixa mista foi escrito à mão
 * e fica exatamente como está. Regras para o que é convertido:
 *   - cada palavra vira "Inicial Maiúscula";
 *   - preposições (de, em, com…) ficam minúsculas no meio do nome;
 *   - siglas de até 2 letras ficam como estão ("ML", "V", "GG").
 *
 * É só EXIBIÇÃO: a busca usa `name_search` no banco e o pedido relê o nome
 * original do produto no servidor.
 */
const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "em", "com", "e", "a", "o", "para", "sem"]);

export function displayProductName(name: string): string {
  if (name !== name.toLocaleUpperCase("pt-BR")) return name;
  return name
    .split(/(\s+)/)
    .map((palavra, i) => {
      if (/^\s+$/.test(palavra)) return palavra;
      const lower = palavra.toLocaleLowerCase("pt-BR");
      if (i > 0 && MINUSCULAS.has(lower)) return lower;
      // Sigla curta (ML, V, GG) ou medida (39/44): fica como veio.
      if (palavra.replace(/[^\p{L}]/gu, "").length <= 2) return palavra;
      return lower.replace(
        /(^|[-/])([\p{L}])/gu,
        (_, sep, ch) => sep + ch.toLocaleUpperCase("pt-BR"),
      );
    })
    .join("");
}
