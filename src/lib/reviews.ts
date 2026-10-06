import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { CACHE_TAGS } from "@/lib/products";

/**
 * Avaliações de produto (migração 0029, `product_reviews`).
 *
 * Leitura PÚBLICA e cacheada (o RLS só entrega as publicadas): a página do
 * produto é estática e não pode pagar consulta por visita. A etiqueta
 * `avaliacoes` é derrubada quando alguém modera no painel — avaliação nova
 * entra como "pendente" e não muda nada na loja até ser aprovada.
 *
 * Antes da migração a tabela não existe: a leitura falha e a página sai sem
 * a seção (nada é cacheado na falha).
 */

export type ProductReview = {
  rating: number;
  body: string | null;
  author: string;
  createdAt: string;
};

export type ProductReviews = {
  media: number;
  total: number;
  itens: ProductReview[];
};

const VAZIO: ProductReviews = { media: 0, total: 0, itens: [] };

const lerAvaliacoes = unstable_cache(
  async (productId: string): Promise<ProductReviews> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("product_reviews")
      .select("rating, body, author_name, created_at")
      .eq("product_id", productId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(`avaliações: ${error.message}`);
    const linhas = data ?? [];
    const total = linhas.length;
    const media = total
      ? linhas.reduce((s, r) => s + Number(r.rating), 0) / total
      : 0;
    return {
      media,
      total,
      itens: linhas.slice(0, 20).map((r) => ({
        rating: Number(r.rating),
        body: r.body,
        author: r.author_name || "Cliente",
        createdAt: r.created_at,
      })),
    };
  },
  ["avaliacoes"],
  { revalidate: 3600, tags: [CACHE_TAGS.avaliacoes] },
);

export async function getProductReviews(
  productId: string,
): Promise<ProductReviews> {
  try {
    return await lerAvaliacoes(productId);
  } catch {
    return VAZIO;
  }
}

/** "Gabriel T." — primeiro nome e inicial do último, como aparece na loja. */
export function nomePublico(fullName: string | null | undefined): string {
  const partes = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "Cliente";
  const primeiro = partes[0];
  const ultimo = partes.length > 1 ? ` ${partes[partes.length - 1][0]}.` : "";
  return `${primeiro[0].toUpperCase()}${primeiro.slice(1).toLowerCase()}${ultimo.toUpperCase()}`;
}
