import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/products";

/**
 * sitemap.xml — o Google descobre os produtos sem depender de rastrear link a
 * link. Custo: `getProducts` já é cacheado (`unstable_cache`, etiqueta
 * `catalogo`), e a rota inteira revalida no máximo 1x/hora — robô nenhum
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
  const { items } = await getProducts({});

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/produtos`, changeFrequency: "daily", priority: 0.9 },
    ...items.map((p) => ({
      url: `${base}/produtos/${p.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
