import type { MetadataRoute } from "next";
import { getCategoryCovers, getProductSlugs } from "@/lib/products";
import { categorySlug } from "@/lib/categories";
import type { Department } from "@/lib/departments";

/**
 * sitemap.xml — o Google descobre os produtos sem depender de rastrear link a
 * link. Custo: só os slugs (`getProductSlugs`, cacheado na etiqueta `capas`), e a rota inteira revalida no máximo 1x/hora — robô nenhum
 * consegue transformar isto em consulta por visita.
 */
export const revalidate = 3600;

function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  try {
    if (raw) return new URL(raw).origin;
  } catch {
    /* cai no padrão */
  }
  return "https://uzzostore.com.br";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [slugs, categorias] = await Promise.all([
    getProductSlugs(),
    getCategoryCovers(),
  ]);

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/masculino`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/feminino`, changeFrequency: "weekly", priority: 0.6 },
    // Categorias com peça ativa EM CADA departamento, em endereço limpo
    // (`/masculino/polos`, `/feminino/blusas`). Categoria sem peça naquele
    // departamento fica de fora — a rota dela responde 404.
    ...(Object.keys(categorias) as Department[]).flatMap((dep) =>
      categorias[dep].map((c) => ({
        url: `${base}/${dep}/${categorySlug(c.name)}`,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ),
    { url: `${base}/ofertas`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/destaques`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/produtos`, changeFrequency: "daily", priority: 0.8 },
    ...slugs.map((slug) => ({
      url: `${base}/produtos/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
