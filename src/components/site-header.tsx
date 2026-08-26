"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Logo } from "@/components/logo";
import { CartButton } from "@/components/cart-button";

/**
 * Passou do limite de rolagem?
 *
 * `useSyncExternalStore` em vez de `useState` + `useEffect`: o lint do React
 * Compiler trata setState síncrono dentro de effect como erro, e este hook é o
 * padrão para estado que vem de fonte externa (o scroll do navegador). O
 * snapshot do servidor devolve `false`, o mesmo valor inicial do cliente — sem
 * divergência de hidratação.
 */
function useRolou(limite = 24): boolean {
  return useSyncExternalStore(
    (avisa) => {
      window.addEventListener("scroll", avisa, { passive: true });
      return () => window.removeEventListener("scroll", avisa);
    },
    () => window.scrollY > limite,
    () => false,
  );
}

/**
 * Cabeçalho do site. Na HOME e SÓ NO CELULAR ele flutua sobre o banner, que
 * passa a começar no topo da tela.
 *
 * Por que: num aparelho de 375x812 o cabeçalho comia 107px empilhados ACIMA do
 * banner, e junto com os 469px do banner sobrava quase nada para o produto —
 * quem vinha do Instagram via banner e ia embora sem ver uma roupa. Flutuando,
 * esses 107px voltam para o conteúdo sem cortar um pixel da arte.
 *
 * ⚠️ NÃO é transparente de verdade, é VIDRO (`bg-background/45` + blur). O logo
 * tem `dark:invert`: no tema escuro ele é BRANCO, e as artes do banner são
 * claras — transparência total faria o logo sumir. O véu leve mantém a leitura
 * em qualquer slide, claro ou escuro, e o banner continua visível atrás.
 *
 * ⚠️ No celular a posição é SEMPRE `fixed` na home, mesmo depois de rolar; só o
 * fundo muda. Alternar entre `fixed` e `sticky` no scroll devolveria o
 * cabeçalho ao fluxo e o conteúdo daria um salto de 107px.
 *
 * No desktop (`sm:`) nada muda: `sticky`, sólido, no fluxo. Lá não há aperto de
 * espaço, e o banner é limitado a 80% da largura — um cabeçalho flutuante
 * ficaria sobre a arte no centro e sobre o fundo da página nas laterais.
 */
export function SiteHeader({
  isLogged,
  isAdmin,
  whatsappUrl,
}: {
  isLogged: boolean;
  isAdmin: boolean;
  whatsappUrl: string;
}) {
  const naHome = usePathname() === "/";
  const rolou = useRolou();
  const sobreBanner = naHome && !rolou;

  // ⚠️ UMA classe de fundo por estado — nunca um par `bg-x sm:bg-y`.
  // Tentei `bg-background/45 sm:bg-background/80` e depois o inverso com
  // `max-sm:`, e nos DOIS casos a versão errada venceu: o Tailwind v4 emite as
  // utilidades na ordem em que as descobre no código, e `bg-background/80` já
  // existia em outros arquivos, então saiu antes no CSS. Como as duas são
  // seletor de classe simples, quem decide é a ordem no arquivo — que aqui é
  // imprevisível. Com um valor só por estado o problema não existe.
  //
  // O véu vale também no desktop, e isso é inofensivo: lá o cabeçalho fica
  // ACIMA do banner (que começa a 131px), então translucidez sobre o fundo da
  // página é visualmente igual ao opaco. A borda fica sempre visível, para o
  // topbar ter aresta definida sobre a arte.
  const posicao = naHome ? "fixed inset-x-0 sm:sticky" : "sticky";
  const fundo = sobreBanner ? "bg-background/45" : "bg-background/80";

  return (
    <header
      className={`${posicao} top-0 z-40 border-b border-border backdrop-blur transition-colors duration-300 ${fundo}`}
    >
      <div className="mx-auto flex w-full items-center justify-between px-6 py-3 sm:w-[80%]">
        <Link href="/" aria-label="Uzzo Store — início">
          <Logo height={27} />
        </Link>
        <div className="flex items-center gap-5">
          <a
            href={whatsappUrl}
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
          {/* Conta como ÍCONE só no celular: no desktop ela continua sendo
              texto na fileira de menu, que ali não custa espaço. */}
          <Link
            href={isLogged ? "/conta" : "/entrar"}
            aria-label={isLogged ? "Minha conta" : "Entrar"}
            className="-m-2 inline-flex items-center p-2 text-muted transition-colors hover:text-foreground sm:hidden"
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
            </svg>
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="text-xs font-medium uppercase tracking-[0.15em] text-foreground sm:hidden"
            >
              Admin
            </Link>
          )}
          <CartButton />
        </div>
      </div>
      {/* Segunda fileira SÓ no desktop. No celular ela custava ~48px dos 812 da
          tela e não pagava: "Home" repete o logo, "Produtos" repete a lupa, e
          conta/Admin viraram ícone na fileira de cima. O cabeçalho caiu de
          ~107px para ~56px, e esses 51px vão para o produto. */}
      <nav className="hidden border-t border-border sm:block">
        <div className="mx-auto flex w-full items-center gap-6 px-6 py-3 text-sm sm:w-[80%]">
          <Link href="/" className="text-muted hover:text-foreground">
            Home
          </Link>
          <Link href="/produtos" className="text-muted hover:text-foreground">
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
  );
}
