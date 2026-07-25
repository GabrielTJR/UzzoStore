import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

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
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Uzzo Store",
  },
};

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-baseline gap-1.5 ${className}`}>
      <span className="font-serif text-2xl font-semibold tracking-tight">
        UZZO
      </span>
      <span className="text-[0.6rem] font-medium uppercase tracking-[0.35em] text-muted">
        Store
      </span>
    </span>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <a href="/" aria-label="Uzzo Store — início">
              <Wordmark />
            </a>
            <nav className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              Balneário Camboriú · SC
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <Wordmark />
              <p className="max-w-xs text-sm text-muted">
                Tecnologia aplicada ao vestir — conforto, praticidade e
                elegância.
              </p>
            </div>
            <div className="flex flex-col gap-1 text-sm text-muted sm:items-end">
              <a
                href="https://www.instagram.com/uzzostorebc/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                @uzzostorebc
              </a>
              <span>Balneário Camboriú · SC · Envio para todo o Brasil</span>
              <span className="mt-2 text-xs">
                © 2026 Uzzo Store. Todos os direitos reservados.
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
