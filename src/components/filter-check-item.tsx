"use client";

import Link, { useLinkStatus } from "next/link";

/** Ponto pulsante enquanto a navegação do filtro está em andamento. */
function Pending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-foreground"
    />
  );
}

/**
 * Item de filtro em formato checkbox. Navega por URL (server-side), mas mostra
 * um sinal de "carregando" no item clicado: sem isso a tela ficava idêntica
 * pelos ~0,5s da ida ao servidor e parecia travada.
 */
export function FilterCheckItem({
  href,
  checked,
  children,
}: {
  href: string;
  checked: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={`${checked ? "Remover filtro" : "Filtrar por"} ${String(children)}`}
      className="group flex items-center gap-2.5 py-1.5 text-sm transition-colors hover:text-foreground"
    >
      <span
        aria-hidden
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none transition-colors ${
          checked
            ? "border-foreground bg-foreground text-background"
            : "border-border group-hover:border-foreground"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
      <span className={checked ? "font-medium" : "text-muted"}>{children}</span>
      <Pending />
    </Link>
  );
}
