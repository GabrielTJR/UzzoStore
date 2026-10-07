import type { ReactNode } from "react";
import { SignOutButton } from "./sign-out-button";
import { AccountNav } from "./account-nav";

/**
 * Casca da área do cliente: saudação, navegação entre as seções e "Sair".
 *
 * Celular: saudação com "Sair" ao lado e as abas logo abaixo, antes do
 * conteúdo — o cliente vê onde está sem abrir menu nenhum. Desktop: coluna
 * lateral fixa à esquerda e a página à direita. Página de conta é de
 * formulário e lista, então fica num `max-w` centralizado (linha de 1900px
 * ninguém lê), com o mesmo respiro lateral da loja.
 *
 * Só desenho: quem protege as páginas é o `requireCustomer` de cada uma.
 */
export function AccountShell({
  firstName,
  email,
  active,
  children,
}: {
  firstName: string | null;
  email: string | null;
  /** Só para a rota de prévia (ver `AccountNav`). */
  active?: string;
  children: ReactNode;
}) {
  return (
    <div className="px-page mx-auto w-full max-w-6xl pb-16 pt-6 md:pt-10">
      {/* Saudação numa FAIXA acima das colunas. Na lateral, "Olá, Gabriel"
          ficava ao lado do título da página com o mesmo tamanho e a tela
          parecia ter dois títulos brigando (o dono apontou, 07/10/2026). */}
      <header className="flex items-start justify-between gap-4 md:border-b md:border-border md:pb-6">
        <div className="min-w-0">
          <p className="text-sm text-muted">Minha conta</p>
          <p className="font-display text-2xl font-bold leading-tight md:text-3xl">
            {firstName ? `Olá, ${firstName}` : "Bem-vindo"}
          </p>
          {email && (
            <p className="mt-0.5 truncate text-sm text-muted">{email}</p>
          )}
        </div>
        {/* No celular o "Sair" fica ao lado da saudação; no desktop desce
            para o pé da coluna, longe dos links de uso diário. */}
        <SignOutButton className="md:hidden" />
      </header>

      <div className="md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:gap-12 md:pt-8 lg:gap-16">
        <aside className="mt-4 md:sticky md:top-24 md:mt-0 md:self-start">
          <AccountNav active={active} />
          <SignOutButton className="mt-6 hidden border-t border-border pt-4 md:block" />
        </aside>

        {/* Altura mínima: página vazia não deixa o rodapé subir até o meio. */}
        <div className="min-h-[50vh] pt-8 md:pt-0">{children}</div>
      </div>
    </div>
  );
}

/** Título de cada página da conta (o `h1`; a saudação da casca não é título). */
export function AccountHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 md:mb-8">
      <div>
        <h1 className="font-display text-xl font-bold md:text-2xl">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}
