"use client";

import { useCallback, useEffect, useState } from "react";
import { IconClose, IconFilter } from "@/components/icons";
import { useModal } from "@/lib/use-modal";

/**
 * Onde os filtros do catálogo moram.
 *
 * - Desktop: coluna lateral fixa (`sticky`) ao lado da grade, sempre aberta.
 * - Celular: uma barra grudada sob o cabeçalho com "Filtros" e "Ordenar"; os
 *   filtros abrem numa folha de tela cheia, com um botão no rodapé que mostra
 *   quantas peças sobraram e fecha. A barra continua visível enquanto se rola
 *   a grade — filtrar não exige voltar ao topo.
 *
 * Os filtros (`children`) são links renderizados no servidor; marcar um navega
 * por URL e a folha continua aberta (o estado deste componente sobrevive à
 * navegação), com o total do botão já atualizado.
 *
 * EXCEÇÃO: vindo de `/masculino`, `/masculino/<cat>` ou `/ofertas`, o primeiro
 * filtro leva a `/produtos?…`, que é OUTRA página — o componente remonta e o
 * estado se perderia (a folha fechava no primeiro toque). Por isso o toque num
 * filtro deixa um aviso de vida curta no sessionStorage, e a página seguinte
 * reabre a folha.
 */
const REABRIR = "uzzo-filtros-abertos";
const REABRIR_JANELA_MS = 15_000;
export function FilterPanel({
  activeCount,
  total,
  sort,
  children,
}: {
  activeCount: number;
  total: number;
  /** Seletor de ordenação — vai na barra do celular, ao lado de "Filtros". */
  sort: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
    try {
      sessionStorage.removeItem(REABRIR);
    } catch {}
  }, []);

  // Reabre a folha se o cliente acabou de tocar num filtro na página anterior.
  useEffect(() => {
    try {
      const t = Number(sessionStorage.getItem(REABRIR));
      sessionStorage.removeItem(REABRIR);
      if (
        t &&
        Date.now() - t < REABRIR_JANELA_MS &&
        !window.matchMedia("(min-width: 64rem)").matches
      )
        // Estado vindo de fora (storage do navegador) na montagem: não há
        // como ler isso no render sem divergir do HTML do servidor.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOpen(true);
    } catch {}
  }, []);
  const ref = useModal<HTMLDivElement>(open, close);

  // Se a tela crescer para o desktop com a folha aberta, fecha: lá os filtros
  // já estão na lateral e a trava de scroll ficaria presa sem ter o que fechar.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 64rem)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [open]);

  return (
    <>
      {/* Celular: barra grudada */}
      <div className="sticky top-[var(--header-h)] z-30 -mx-[var(--page-px)] mb-4 grid grid-cols-2 border-y border-border bg-background lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="flex h-12 items-center justify-center gap-2 border-r border-border text-sm font-semibold"
        >
          <IconFilter size={18} />
          Filtros
          {activeCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[0.7rem] font-bold text-background">
              {activeCount}
            </span>
          )}
        </button>
        <div className="flex h-12 items-center justify-center">{sort}</div>
      </div>

      {/* Desktop: coluna lateral */}
      <aside
        aria-label="Filtros"
        className="hidden lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:block lg:max-h-[calc(100svh-var(--header-h)-3rem)] lg:self-start lg:overflow-y-auto lg:pr-3"
      >
        {children}
      </aside>

      {/* Celular: folha de filtros */}
      {open && (
        <div
          ref={ref}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Filtros"
          className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-background outline-none lg:hidden"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
            <h2 className="font-display text-lg font-bold">Filtros</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Fechar filtros"
              className="-m-2 p-2"
            >
              <IconClose />
            </button>
          </div>
          <div
            className="flex-1 overflow-y-auto px-4 py-5"
            onClickCapture={(e) => {
              if ((e.target as HTMLElement).closest("a[href]"))
                try {
                  sessionStorage.setItem(REABRIR, String(Date.now()));
                } catch {}
            }}
          >
            {children}
          </div>
          <div className="shrink-0 border-t border-border p-4">
            <button
              type="button"
              onClick={close}
              className="flex h-13 w-full items-center justify-center rounded-xs bg-foreground text-[0.95rem] font-semibold text-background"
            >
              {total === 0
                ? "Nenhuma peça com esses filtros"
                : `Ver ${total} ${total === 1 ? "peça" : "peças"}`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
