import type { MetadataRoute } from "next";

/** robots.txt — libera a vitrine e fecha o que não é página de produto
 * (admin, conta, fluxo de compra). Aponta o sitemap. */
export default function robots(): MetadataRoute.Robots {
  const base = (() => {
    const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    try {
      if (raw) return new URL(raw).origin;
    } catch {
      /* cai no padrão */
    }
    return "https://uzzostore.com.br";
  })();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // Armadilha de faceta: /produtos?categorias=...&cores=... gera um
        // espaço COMBINATÓRIO de URLs — o GPTBot fez 77 mil requisições em
        // 12h navegando essas combinações (ago/2026). O catálogo continua
        // indexável por /produtos e /produtos/[slug]; as facetas, não.
        "/produtos?",
        "/*?busca=",
        "/*?ordem=",
        "/*?pagina=",
        "/admin",
        "/conta",
        "/sacola",
        "/checkout",
        "/api/",
        "/entrar",
        "/cadastro",
        "/esqueci-senha",
        "/nova-senha",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
