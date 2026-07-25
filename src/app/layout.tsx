import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { CartButton } from "@/components/cart-button";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const WHATSAPP_URL = "https://wa.me/5547992203156";
const MAPS_URL = "https://maps.app.goo.gl/bUxWeib7bJHjGp3K6";
const INSTAGRAM_URL = "https://www.instagram.com/uzzostorebc/";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Uzzo Store — Moda masculina em Balneário Camboriú",
    template: "%s | Uzzo Store",
  },
  description:
    "Moda masculina da Uzzo Store: tecnologia aplicada ao vestir — conforto, praticidade e elegância. Balneário Camboriú, com envio para todo o Brasil.",
  openGraph: { type: "website", locale: "pt_BR", siteName: "Uzzo Store" },
};

function Logo({
  size = 56,
  priority = false,
}: {
  size?: number;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Uzzo Store"
      width={size}
      height={size}
      priority={priority}
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" aria-label="Uzzo Store — início">
              <Logo size={72} priority />
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
              <CartButton />
            </div>
          </div>
          <nav className="border-t border-border">
            <div className="mx-auto flex max-w-6xl gap-6 px-6 py-3 text-sm">
              <Link href="/" className="text-muted hover:text-foreground">
                Home
              </Link>
              <Link
                href="/produtos"
                className="text-muted hover:text-foreground"
              >
                Produtos
              </Link>
            </div>
          </nav>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-3">
              <Logo size={64} />
              <p className="max-w-xs text-sm text-muted">
                Tecnologia aplicada ao vestir — conforto, praticidade e
                elegância.
              </p>
            </div>

            <div className="space-y-2 text-sm text-muted">
              <h3 className="font-medium text-foreground">Contato</h3>
              <p>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  WhatsApp (47) 99220-3156
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
          </div>

          <div className="border-t border-border">
            <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-muted">
              © 2026 Uzzo Store. Todos os direitos reservados.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
