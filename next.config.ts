import type { NextConfig } from "next";

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
};

export default nextConfig;
