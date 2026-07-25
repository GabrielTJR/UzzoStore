/**
 * Categorias do menu (provisórias até virem do Microvix).
 * Os `slug` batem com os dados de teste em supabase/seed.sql.
 */
export const CATEGORIES = [
  { slug: "camisetas", name: "Camisetas" },
  { slug: "camisas", name: "Camisas" },
  { slug: "calcas", name: "Calças" },
  { slug: "bermudas", name: "Bermudas" },
  { slug: "moletons", name: "Moletons" },
  { slug: "acessorios", name: "Acessórios" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
