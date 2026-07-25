import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Uzzo Store — Moda em Balneário Camboriú",
    template: "%s | Uzzo Store",
  },
  description:
    "Loja de roupas da Uzzo Store, em Balneário Camboriú (SC). Novidades, tendências e atendimento local.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Uzzo Store",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
        <header className="border-b border-black/10 dark:border-white/10">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <a href="/" className="text-xl font-semibold tracking-tight">
              UZZO<span className="text-zinc-400">STORE</span>
            </a>
            <nav className="text-sm text-zinc-500">Balneário Camboriú · SC</nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-black/10 dark:border-white/10">
          <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-zinc-500">
            © 2026 Uzzo Store · Balneário Camboriú/SC
          </div>
        </footer>
      </body>
    </html>
  );
}
