/**
 * Ordenações da vitrine — módulo NEUTRO (sem imports de servidor).
 *
 * Fica fora de `products.ts` de propósito: o seletor é client component e,
 * importando de lá, o bundle do navegador puxaria `next/headers` e o build
 * quebrava.
 */
export const SORT_OPTIONS = {
  categoria: "Categoria",
  "menor-preco": "Menor preço",
  "maior-preco": "Maior preço",
  nome: "Nome (A–Z)",
  promocao: "Promoções primeiro",
} as const;

export type SortKey = keyof typeof SORT_OPTIONS;

export function isSortKey(v: unknown): v is SortKey {
  return typeof v === "string" && v in SORT_OPTIONS;
}
