"use client";

import { useRouter } from "next/navigation";
import { useCallback, useId, useState, useTransition } from "react";
import { IconClose } from "@/components/icons";
import { useModal } from "@/lib/use-modal";

/**
 * Casca do MODAL DE DETALHE de um evento do registro — só a moldura. O
 * conteúdo vem do servidor, que só lê o evento aberto (`?evento=<id>`).
 *
 * Mesma receita do modal da audiência: quem decide se ele existe é a URL, e
 * fechar é navegar com `replace` para a mesma tela sem `evento` — mantendo os
 * filtros e a página (`closeHref`, montado no servidor) e sem empilhar uma
 * entrada no histórico por evento conferido.
 */
export function LogModal({
  title,
  closeHref,
  children,
}: {
  title: string;
  closeHref: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const titleId = useId();
  const [fechando, startTransition] = useTransition();
  const [sumiu, setSumiu] = useState(false);
  const close = useCallback(() => {
    setSumiu(true);
    startTransition(() => router.replace(closeHref, { scroll: false }));
  }, [router, closeHref]);
  const oculto = sumiu || fechando;
  const ref = useModal<HTMLDivElement>(!oculto, close);

  if (oculto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Fechar detalhes"
        onClick={close}
        className="absolute inset-0 animate-fade-in cursor-default bg-black/60"
      />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full animate-fade-in flex-col bg-background outline-none sm:max-h-[90vh] sm:max-w-2xl sm:rounded-sm sm:border sm:border-border sm:shadow-2xl"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3 sm:px-6">
          <h2
            id={titleId}
            className="font-display min-w-0 flex-1 text-lg font-bold leading-snug"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Fechar detalhes"
            className="-m-2 shrink-0 p-2"
          >
            <IconClose />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {children}
        </div>

        <footer className="flex shrink-0 justify-end border-t border-border px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={close}
            className="h-10 w-full rounded-xs border border-border px-5 text-sm font-medium hover:border-foreground sm:w-auto"
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}
