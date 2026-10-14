"use client";

import Link, { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

/** Enquanto a navegação deste filtro anda, a opção esmaece: sem isso a tela
 * ficava igual pelos ~0,5 s da ida ao servidor e parecia travada. */
function Carregando({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span className={pending ? "animate-pulse opacity-60" : undefined}>
      {children}
    </span>
  );
}

/**
 * Opção de filtro da barra do catálogo. É um LINK (o filtro mora na URL), com
 * `prefetch={false}` (o espaço de combinações é enorme; ver catalog-url.ts),
 * `scroll={false}` (marcar não pula a página) e o tipo de transição "filtro"
 * (a troca é instantânea — sem a foto voando nem esmaecido).
 *
 * - `texto`: retângulo com o nome; marcado = preto, como o botão principal.
 * - `cor`: bolinha da cor com o nome embaixo; marcada = anel.
 */
export function FilterOption({
  href,
  checked,
  children,
  swatch,
}: {
  href: string;
  checked: boolean;
  children: ReactNode;
  /** Cor da bolinha (hex) — vira a opção de cor. `null` = sem cor cadastrada. */
  swatch?: string | null;
}) {
  if (swatch !== undefined)
    return (
      <Link
        href={href}
        prefetch={false}
        transitionTypes={["filtro"]}
        data-filtro
        scroll={false}
        aria-pressed={checked}
        className="flex flex-col items-center gap-1.5 rounded-xs py-1"
      >
        <Carregando>
          <span
            className={`block h-8 w-8 rounded-full border border-border transition-shadow ${
              checked
                ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                : ""
            }`}
            style={{ background: swatch ?? "var(--surface)" }}
          />
        </Carregando>
        <span
          className={`text-center text-[0.72rem] leading-tight ${
            checked ? "font-semibold" : "text-muted"
          }`}
        >
          {children}
        </span>
      </Link>
    );
  return (
    <Link
      href={href}
      prefetch={false}
      transitionTypes={["filtro"]}
      data-filtro
      scroll={false}
      aria-pressed={checked}
      className={`flex min-h-10 items-center rounded-xs px-3 text-sm transition-colors ${
        checked
          ? "bg-foreground font-semibold text-background"
          : "hover:bg-surface"
      }`}
    >
      <Carregando>{children}</Carregando>
    </Link>
  );
}
