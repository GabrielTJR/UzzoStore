import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança — FIXOS de propósito. A CSP com "nonce" que a
 * documentação do Next recomenda obriga toda página a ser montada por visita
 * (o nonce muda a cada resposta): a vitrine deixaria de ser estática e o custo
 * por visita voltaria. Por isso `'unsafe-inline'` nos scripts (o Next injeta
 * scripts inline sem nonce); o ganho que fica é bloquear script/conexão de
 * QUALQUER outro domínio, moldura de site alheio (clickjacking do /admin) e
 * `<base>`/`<object>` injetados.
 *
 * Ao adicionar um serviço que roda NO NAVEGADOR (script, fetch, iframe),
 * inclua o domínio aqui — senão ele é bloqueado em silêncio (só aparece no
 * console). Hoje: Supabase (auth/storage), Turnstile, Google Analytics, ViaCEP.
 */
const SUPABASE = "https://anlbavcstwffnpisacax.supabase.co";
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE} https://*.google-analytics.com https://*.googletagmanager.com`,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE} wss://anlbavcstwffnpisacax.supabase.co https://challenges.cloudflare.com https://viacep.com.br https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com`,
  // 'self': a prévia do editor da página inicial abre a loja numa moldura.
  "frame-src 'self' https://challenges.cloudflare.com",
  "frame-ancestors 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "anlbavcstwffnpisacax.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // O otimizador da Vercel baixa o ORIGINAL do Supabase a cada expiração de
    // cache, por variante (largura × formato). Com o padrão (4 h) e fotos de
    // ~1,7 MB isso torrou o egress do plano free. 31 dias é seguro porque toda
    // foto nova entra com um nome novo (uuid), então a URL — a chave do cache —
    // muda junto; não existe "mesma URL com outra imagem".
    minimumCacheTTL: 2678400, // 31 dias
    // Menos larguras = menos variantes = menos downloads do original. Estas
    // cobrem os `sizes` usados na loja (100vw / 50vw / 33vw / 25vw).
    deviceSizes: [640, 828, 1080, 1920],
    // Miniaturas (`sizes` fixos: 64px, 128px, 160px, 200px). Todas menores que
    // o menor deviceSize, como o Next exige.
    imageSizes: [64, 128, 200, 384],
    // Só WebP: com AVIF+WebP a Vercel guarda (e busca) duas versões de cada.
    formats: ["image/webp"],
  },
  /**
   * Seis produtos reais nasceram editando as linhas de SEED e herdaram o slug
   * do produto fictício — uma calça morava em /camiseta-tech-dry-preta. Os
   * slugs foram corrigidos no banco; estes redirecionamentos existem porque a
   * loja divulga link de produto em WhatsApp e Instagram (é por isso que a
   * página tem openGraph), e link compartilhado não volta atrás. 301 para o
   * Google entender que é mudança de endereço, não conteúdo novo.
   */
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return [
      ["camiseta-tech-dry-preta", "calca-premium-poliamida"],
      ["camiseta-basica-off-white", "calca-tech-elastico"],
      ["camisa-slim-de-linho", "camiseta-resistente-a-agua"],
      ["camisa-social-preta", "camisa-social-ultra-tech"],
      ["calca-de-alfaiataria", "bermuda-zara-premium"],
      ["moletom-essential", "calca-zara-alfaiataria"],
    ].map(([de, para]) => ({
      source: `/produtos/${de}`,
      destination: `/produtos/${para}`,
      permanent: true,
    }));
  },
};

export default nextConfig;
