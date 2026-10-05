import type { ReactNode } from "react";

/**
 * Moldura das telas de acesso (entrar, criar conta, esqueci/nova senha):
 * uma coluna estreita, título largo e o formulário logo abaixo. No celular
 * nada de caixa em volta — a borda roubaria largura do campo — e o conteúdo
 * começa perto do topo, para o teclado aberto não esconder o botão.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="px-page mx-auto w-full max-w-md pb-16 pt-8 md:pt-16">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      <div className="mt-8">{children}</div>
      {footer && <div className="mt-6">{footer}</div>}
    </section>
  );
}
