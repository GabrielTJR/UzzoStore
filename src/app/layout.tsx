import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Logo } from "@/components/logo";
import { SiteHeader } from "@/components/site-header";
import { CartDrawer } from "@/components/cart-drawer";
import { WhatsappFab } from "@/components/whatsapp-fab";
import { ToastProvider } from "@/components/toast";
import { NewsletterForm } from "@/components/newsletter-form";
import { getAdminUser } from "@/lib/admin";
import { getSessionUser } from "@/lib/session";
import { getHomeSections } from "@/lib/products";
import { shippingConfigured } from "@/lib/shipping";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const WHATSAPP_URL = "https://wa.me/5547991744865";
const MAPS_URL = "https://maps.app.goo.gl/bUxWeib7bJHjGp3K6";
const INSTAGRAM_URL = "https://www.instagram.com/uzzostorebc/";

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
    default: "Uzzo Store — Moda masculina em Balneário Camboriú",
    template: "%s | Uzzo Store",
  },
  description:
    "Moda masculina da Uzzo Store: tecnologia aplicada ao vestir — conforto, praticidade e elegância. Balneário Camboriú, com envio para todo o Brasil.",
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

// O `Logo` mora em `components/logo.tsx` desde que o cabeçalho virou client
// component (ele precisa de estado de rolagem para flutuar sobre o banner).

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [adminUser, sessionUser, sections] = await Promise.all([
    getAdminUser(),
    getSessionUser(),
    getHomeSections(),
  ]);
  const isAdmin = !!adminUser;
  const isLogged = !!sessionUser; // cliente OU admin
  const notice = sections.find((s) => s.kind === "aviso")?.data;
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {notice?.text && (
          <div className="bg-foreground px-6 py-2 text-center text-xs font-medium uppercase tracking-[0.2em] text-background">
            {notice.href ? (
              <Link href={notice.href} className="hover:underline">
                {notice.text}
              </Link>
            ) : (
              notice.text
            )}
          </div>
        )}
        <SiteHeader
          isLogged={isLogged}
          isAdmin={isAdmin}
          whatsappUrl={WHATSAPP_URL}
        />

        <main className="flex-1">
          <ToastProvider>{children}</ToastProvider>
        </main>

        {/* Gaveta da sacola (client, zustand) + WhatsApp flutuante. Montados
            no layout para funcionarem em qualquer página da vitrine. */}
        <CartDrawer shippingEnabled={shippingConfigured()} />
        <WhatsappFab />

        <footer className="border-t border-border">
          {/* No celular o rodapé tinha 984px — 1,2 tela só de rodapé, com os 5
              blocos empilhados um sob o outro. Duas colunas cortam isso quase
              pela metade sem esconder nada; no `lg` seguem as 5 de sempre. */}
          <div className="mx-auto grid w-full grid-cols-2 gap-x-6 gap-y-7 px-6 py-8 sm:w-[80%] sm:grid-cols-2 sm:gap-8 sm:py-12 lg:grid-cols-5">
            <div className="col-span-2 space-y-3 sm:col-span-1">
              {/* Menor no celular: sozinho numa linha de largura inteira, o
                  mesmo logo do cabeçalho (que ali é ladeado por ícones) lê como
                  grande demais. É problema de isolamento, não de pixels. */}
              <Logo height={30} className="h-6 sm:h-[30px]" />
              {/* A tagline repete o que o banner já diz e, no fim de uma página
                  longa, é texto apagado que ninguém lê. Só desktop. */}
              <p className="hidden max-w-xs text-sm text-muted sm:block">
                Tecnologia aplicada ao vestir — conforto, praticidade e
                elegância.
              </p>
            </div>

            <nav
              className="space-y-2 text-sm text-muted"
              aria-label="Navegação do rodapé"
            >
              <h3 className="font-medium text-foreground">Loja</h3>
              {/* Estes quatro já estão a UM toque no cabeçalho: catálogo e
                  promoções pela lupa, conta e pedidos pelo ícone de conta.
                  Repeti-los no rodapé do celular custa 4 linhas e não adiciona
                  caminho nenhum. No desktop ficam, porque lá cabem. */}
              <p className="hidden sm:block">
                <Link href="/produtos" className="hover:text-foreground">
                  Todos os produtos
                </Link>
              </p>
              <p className="hidden sm:block">
                <Link
                  href="/produtos?promo=1"
                  className="hover:text-foreground"
                >
                  Promoções
                </Link>
              </p>
              <p className="hidden sm:block">
                <Link href="/conta" className="hover:text-foreground">
                  Minha conta
                </Link>
              </p>
              <p className="hidden sm:block">
                <Link href="/conta/pedidos" className="hover:text-foreground">
                  Meus pedidos
                </Link>
              </p>
              <p>
                <Link href="/trocas" className="hover:text-foreground">
                  Trocas e devoluções
                </Link>
              </p>
              <p>
                <Link href="/faq" className="hover:text-foreground">
                  Perguntas frequentes
                </Link>
              </p>
              <p>
                <Link href="/sobre" className="hover:text-foreground">
                  Sobre a loja
                </Link>
              </p>
            </nav>

            <div className="space-y-2 text-sm text-muted">
              <h3 className="font-medium text-foreground">Contato</h3>
              {/* O WhatsApp é o canal de venda da loja — no celular ele ganha
                  peso de texto em vez de virar mais uma linha apagada. */}
              <p>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground hover:underline sm:font-normal sm:text-muted sm:hover:text-foreground sm:no-underline"
                >
                  WhatsApp (47) 99174-4865
                </a>
              </p>
              <p>Seg a Sex: 10h às 19h</p>
              <p>Sábado: 10h às 14h</p>
            </div>

            <div className="space-y-2 text-sm text-muted">
              <h3 className="font-medium text-foreground">Visite a loja</h3>
              <p>Rua 3650, nº 3573 — Sala 2</p>
              <p>Balneário Camboriú · SC</p>
              <p>
                <a
                  href={MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Ver no mapa
                </a>
              </p>
            </div>

            <div className="space-y-2 text-sm text-muted">
              <h3 className="font-medium text-foreground">Redes</h3>
              <p>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  @uzzostorebc
                </a>
              </p>
              <p>Envio para todo o Brasil</p>
            </div>

            {/* Newsletter como FAIXA de largura inteira, não como mais uma
                coluna. Ela saiu de dentro de "Redes" porque no celular, espremida
                em meia coluna, o campo e o botão ficavam pequenos para o polegar
                — mas virar o 6º bloco de uma grade de 5 colunas a jogava sozinha
                numa segunda linha, com cara de sobra. Ocupando a largura toda e
                separada por uma borda, lê como seção, não como resto. */}
            <div className="col-span-2 border-t border-border pt-6 lg:col-span-5 lg:flex lg:items-center lg:justify-between lg:gap-8 lg:pt-8">
              <h3 className="mb-2 font-medium text-foreground lg:mb-0">
                Fique por dentro
              </h3>
              <NewsletterForm />
            </div>
          </div>

          <div className="border-t border-border">
            <div className="mx-auto flex w-full sm:w-[80%] flex-wrap items-center justify-between gap-2 px-6 py-4 text-xs text-muted">
              {/* Identificação da empresa: o Decreto 7.962/2013 exige razão
                social, CNPJ e endereço físico em local de fácil visualização
                em qualquer site que venda. Não é enfeite de rodapé. */}
              <div className="space-y-0.5">
                <p>
                  © 2026 Uzzo Store · UZZO COMERCIO LTDA · CNPJ
                  67.134.725/0001-43
                </p>
                {/* Rua 3650 e Av. Brasil são a mesma esquina e o cartão CNPJ
                  traz a segunda, mas o site inteiro (retirada, e-mails, frete)
                  usa a primeira — e o CEP 88330-218 é o dela, confirmado, o
                  mesmo que origina as postagens. Endereço divergente entre
                  rodapé e e-mail de retirada é cliente rodando quarteirão. */}
                <p>
                  Rua 3650, nº 3573 — Sala 2, Centro, Balneário Camboriú/SC ·
                  CEP 88330-218
                </p>
              </div>
              {/* Sem número de parcelas aqui: quem decide quantas é a
                configuração da conta na InfinitePay, e a tela dela oferece
                mais que 3. Prometer um teto no rodapé é prometer menos do que
                a loja entrega — e mudar lá não deveria exigir deploy aqui.
                (Débito não entra: o Checkout Integrado só faz Pix e crédito;
                débito é exclusivo da maquininha presencial.) */}
              <span>Pix · Cartão em até 12x (3x sem juros)</span>
            </div>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
