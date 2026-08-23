import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Image from "next/image";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { CartButton } from "@/components/cart-button";
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
 * preto, ficava preta sobre fundo preto, quase invisível. E como o navegador
 * nem informa `prefers-color-scheme: dark` nesse modo, o `dark:invert` da logo
 * nunca disparava.
 *
 * Com `light dark` o navegador para de forçar e deixa o site cuidar do tema,
 * que é o que ele já sabia fazer.
 */
export const viewport: Viewport = {
  colorScheme: "light dark",
};

// Proporção real do arquivo public/logo.png (recortado ao conteúdo).
const LOGO_W = 1815;
const LOGO_H = 524;

function Logo({
  height = 44,
  priority = false,
}: {
  height?: number;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Uzzo Store"
      width={Math.round((height * LOGO_W) / LOGO_H)}
      height={height}
      priority={priority}
      className="w-auto dark:invert"
    />
  );
}

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
        <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex w-full sm:w-[80%] items-center justify-between px-6 py-3">
            <Link href="/" aria-label="Uzzo Store — início">
              <Logo height={27} priority />
            </Link>
            <div className="flex items-center gap-5">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden text-xs font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:text-foreground sm:inline"
              >
                WhatsApp
              </a>
              <Link
                href="/produtos"
                aria-label="Buscar produtos"
                className="-m-2 inline-flex items-center p-2 text-muted transition-colors hover:text-foreground"
              >
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
              </Link>
              <CartButton />
            </div>
          </div>
          <nav className="border-t border-border">
            <div className="mx-auto flex w-full sm:w-[80%] items-center gap-6 px-6 py-3 text-sm">
              <Link href="/" className="text-muted hover:text-foreground">
                Home
              </Link>
              <Link
                href="/produtos"
                className="text-muted hover:text-foreground"
              >
                Produtos
              </Link>
              <Link
                href={isLogged ? "/conta" : "/entrar"}
                className={`text-muted hover:text-foreground ${isAdmin ? "" : "ml-auto"}`}
              >
                {isLogged ? "Minha conta" : "Entrar"}
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="ml-auto font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Admin
                </Link>
              )}
            </div>
          </nav>
        </header>

        <main className="flex-1">
          <ToastProvider>{children}</ToastProvider>
        </main>

        {/* Gaveta da sacola (client, zustand) + WhatsApp flutuante. Montados
            no layout para funcionarem em qualquer página da vitrine. */}
        <CartDrawer shippingEnabled={shippingConfigured()} />
        <WhatsappFab />

        <footer className="border-t border-border">
          <div className="mx-auto grid w-full sm:w-[80%] gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-3">
              <Logo height={30} />
              <p className="max-w-xs text-sm text-muted">
                Tecnologia aplicada ao vestir — conforto, praticidade e
                elegância.
              </p>
            </div>

            <nav
              className="space-y-2 text-sm text-muted"
              aria-label="Navegação do rodapé"
            >
              <h3 className="font-medium text-foreground">Loja</h3>
              <p>
                <Link href="/produtos" className="hover:text-foreground">
                  Todos os produtos
                </Link>
              </p>
              <p>
                <Link
                  href="/produtos?promo=1"
                  className="hover:text-foreground"
                >
                  Promoções
                </Link>
              </p>
              <p>
                <Link href="/conta" className="hover:text-foreground">
                  Minha conta
                </Link>
              </p>
              <p>
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
              <p>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
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
              <div className="pt-2">
                <h3 className="mb-2 font-medium text-foreground">
                  Fique por dentro
                </h3>
                <NewsletterForm />
              </div>
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
              <span>Pix · Cartão de crédito</span>
            </div>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
