"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useId, useState, useTransition } from "react";
import { IconClose } from "@/components/icons";
import { useModal } from "@/lib/use-modal";

/**
 * Casca do MODAL DE DETALHE da audiência (Visão geral do painel). O conteúdo
 * vem do servidor; aqui ficam só a moldura, as abas de período e o fechar.
 *
 * Como o modal de pedido, quem decide se ele existe é a URL
 * (`?detalhe=&periodo=`): o servidor só consulta o Google quando o detalhe é
 * aberto. Fechar é navegar de volta para `/admin` com `replace`, para não
 * empilhar uma entrada no histórico a cada card conferido.
 */
export function AudienceModal({
  title,
  periodos,
  children,
}: {
  title: string;
  /** Abas de período; `null` quando o detalhe é em tempo real. */
  periodos: { rotulo: string; href: string; ativo: boolean }[] | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const titleId = useId();
  const [fechando, startTransition] = useTransition();
  const [sumiu, setSumiu] = useState(false);
  const close = useCallback(() => {
    setSumiu(true);
    startTransition(() => router.replace("/admin", { scroll: false }));
  }, [router]);
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
        className="relative flex w-full animate-fade-in flex-col bg-background outline-none sm:max-h-[90vh] sm:max-w-4xl sm:rounded-sm sm:border sm:border-border sm:shadow-2xl"
      >
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
          <h2
            id={titleId}
            className="font-display min-w-0 flex-1 text-lg font-bold leading-tight"
          >
            {title}
          </h2>
          {periodos && (
            <nav
              aria-label="Período"
              className="order-last flex w-full overflow-hidden rounded-xs border border-border sm:order-none sm:w-auto"
            >
              {periodos.map((p, i) => (
                <Link
                  key={p.href}
                  href={p.href}
                  replace
                  scroll={false}
                  prefetch={false}
                  aria-current={p.ativo ? "page" : undefined}
                  className={`flex h-9 flex-1 items-center justify-center px-3 text-sm sm:flex-none ${
                    i > 0 ? "border-l border-border" : ""
                  } ${
                    p.ativo
                      ? "bg-foreground font-semibold text-background"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {p.rotulo}
                </Link>
              ))}
            </nav>
          )}
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
