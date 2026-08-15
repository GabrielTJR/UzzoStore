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
