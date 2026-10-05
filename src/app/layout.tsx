import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

/**
 * UMA família para o site inteiro. O eixo de largura (`wdth`) é o que dá os
 * títulos expandidos (`font-display` em globals.css) sem carregar uma segunda
 * fonte — antes eram três (Geist, Geist Mono e Playfair).
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

/**
 * Base das URLs de metadados (OG/canonical). Precisa ser uma URL VÁLIDA já no
 * build — `metadataBase` é avaliado no carregamento do módulo, então uma env
 * ausente OU vazia (`new URL("")`) derruba o build inteiro, inclusive páginas
 * estáticas como `/_not-found`. O `??` sozinho não basta: ele só cobre o caso
 * ausente, não a string vazia que a Vercel entrega quando a variável existe sem
 * valor. Por isso validamos e caímos no domínio de produção.
 */
function resolveSiteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  try {
    if (raw) return new URL(raw);
  } catch {
    // valor inválido → usa o padrão abaixo
  }
  return new URL("https://uzzostore.com.br");
}

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  title: {
    default: "Uzzo Store — Tecnologia que veste bem",
    template: "%s | Uzzo Store",
  },
  description:
    "Roupas com tecidos tecnológicos: leves, respiráveis, não amassam e secam rápido. Loja em Balneário Camboriú, com envio para todo o Brasil.",
  openGraph: { type: "website", locale: "pt_BR", siteName: "Uzzo Store" },
};

/**
 * Declara que o site trata os DOIS temas.
 *
 * Sem isto o navegador entende que a página é só clara e liga o escurecimento
 * automático dele (o "modo escuro para sites" do Chrome/Samsung Internet). Esse
 * recurso escurece fundos mas NÃO mexe em imagens — então a logo, que é um PNG
 * preto, ficava preta sobre fundo preto, quase invisível.
 *
 * Com `light dark` o navegador para de forçar e deixa o site cuidar do tema,
 * que é o que ele já sabia fazer. (A logo ganhou defesa própria depois disso —
 * ver `components/logo.tsx`.)
 */
export const viewport: Viewport = {
  colorScheme: "light dark",
};

/**
 * Layout RAIZ: só o que loja e painel têm em comum (fonte, tema, toasts).
 *
 * O cabeçalho, o rodapé, a sacola e o aviso de cookies vivem em
 * `(loja)/layout.tsx`; o painel tem a casca dele em `admin/layout.tsx`. Antes
 * tudo morava aqui e o /admin herdava o cabeçalho e o rodapé da loja — além de
 * pagar, a cada tela do painel, as leituras que só a vitrine usa.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
