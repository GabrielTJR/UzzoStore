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
 * Item de filtro em formato checkbox (ou rádio, com `radio`). Navega por URL
 * (server-side), mas mostra um sinal de "carregando" no item clicado: sem isso
 * a tela ficava idêntica pelos ~0,5s da ida ao servidor e parecia travada.
 *
 * `swatch` mostra a bolinha da cor ao lado do nome (filtro de cor).
 * Altura de 40px no celular: é alvo de polegar, não de mouse.
 */
export function FilterCheckItem({
  href,
  checked,
  radio = false,
  swatch,
  children,
}: {
  href: string;
  checked: boolean;
  radio?: boolean;
  /** Hex da cor; `null` = cor sem hex cadastrado (mostra hachura). */
  swatch?: string | null;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      scroll={false}
      aria-label={`${checked ? "Remover filtro" : "Filtrar por"} ${String(children)}`}
      className="group flex min-h-10 items-center gap-3 text-[0.95rem] lg:min-h-8 lg:text-sm"
    >
      <span
        aria-hidden
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center border text-[11px] leading-none transition-colors ${
          radio ? "rounded-full" : "rounded-xs"
        } ${
          checked
            ? "border-foreground bg-foreground text-background"
            : "border-muted/60 group-hover:border-foreground"
        }`}
      >
        {checked ? (radio ? "•" : "✓") : ""}
      </span>
      {swatch !== undefined && (
        <span
          aria-hidden
          className="h-4 w-4 shrink-0 rounded-full border border-foreground/25"
          style={
            swatch
              ? { backgroundColor: swatch }
              : {
                  backgroundImage:
                    "repeating-linear-gradient(45deg, var(--color-border, #ccc) 0 3px, transparent 3px 6px)",
                }
          }
        />
      )}
      <span className={checked ? "font-semibold" : ""}>{children}</span>
      <Pending />
    </Link>
  );
}
