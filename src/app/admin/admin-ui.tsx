import Link from "next/link";

/**
 * Cabeçalho padrão das telas do painel: (voltar) + título + descrição à
 * esquerda, ações à direita. A navegação entre áreas é do menu lateral — o
 * "voltar" só existe em tela de DETALHE (um produto, um modelo de medidas),
 * para subir um nível.
 */
export function PageHeader({
  title,
  description,
  back,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  /** Ações da tela (botão principal etc.). */
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="mb-2 inline-block text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            ‹ {back.label}
          </Link>
        )}
        <h1 className="font-display text-2xl font-bold lg:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-[70ch] text-sm text-muted">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </header>
  );
}

/** Superfície branca das telas do painel (o fundo da área de trabalho é cinza). */
export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-sm border border-border bg-background ${className}`}
    >
      {children}
    </div>
  );
}

/** Botão principal do painel (link). */
export const primaryButton =
  "inline-flex h-10 items-center gap-2 rounded-xs bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90";

/** Botão secundário do painel (link). */
export const secondaryButton =
  "inline-flex h-10 items-center gap-2 rounded-xs border border-border bg-background px-4 text-sm font-medium transition-colors hover:border-foreground";
