"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBox,
  IconGrid,
  IconHeart,
  IconHome,
  IconUser,
} from "@/components/icons";

/**
 * Navegação da área do cliente. UM elemento para os dois tamanhos: no celular
 * é uma fileira de abas que desliza (é ~96% do público, e as cinco abas não
 * cabem em 360px sem encolher a letra); a partir de `md` vira a coluna da
 * lateral, com ícone.
 *
 * Client component só por causa do `usePathname`: o layout da conta não
 * re-renderiza ao trocar de aba, então quem marca a aba atual é o navegador.
 * `active` existe para a rota de prévia, onde o caminho não é o da conta.
 */
export const ACCOUNT_LINKS = [
  { href: "/conta", label: "Resumo", Icon: IconGrid },
  { href: "/conta/pedidos", label: "Pedidos", Icon: IconBox },
  { href: "/conta/enderecos", label: "Endereços", Icon: IconHome },
  { href: "/conta/dados", label: "Dados", Icon: IconUser },
  { href: "/conta/favoritos", label: "Favoritos", Icon: IconHeart },
] as const;

function isActive(href: string, path: string): boolean {
  // "/conta" só vale exato — senão ficaria marcado em todas as abas.
  return href === "/conta" ? path === "/conta" : path.startsWith(href);
}

export function AccountNav({ active }: { active?: string }) {
  const pathname = usePathname();
  const path = active ?? pathname ?? "";

  return (
    <nav aria-label="Minha conta">
      <ul className="bleed-x scrollbar-hide flex gap-1 overflow-x-auto border-b border-border md:flex-col md:gap-0.5 md:mx-0 md:overflow-visible md:border-b-0 md:px-0">
        {ACCOUNT_LINKS.map(({ href, label, Icon }) => {
          const on = isActive(href, path);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 whitespace-nowrap px-3 text-sm transition-colors md:rounded-xs md:px-3 ${
                  on
                    ? "-mb-px border-b-2 border-foreground font-semibold text-foreground md:mb-0 md:border-b-0 md:bg-surface"
                    : "border-b-2 border-transparent text-muted hover:text-foreground md:border-b-0 md:hover:bg-surface"
                }`}
              >
                <Icon size={18} className="hidden md:block" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
