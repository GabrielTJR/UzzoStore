"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconChevronDown, IconClose } from "@/components/icons";
import { useModal } from "@/lib/use-modal";

export type FilterGroup = {
  id: string;
  rotulo: string;
  /** Quantas opções estão marcadas (vira número no botão). */
  count: number;
  /** As opções — links renderizados no servidor. */
  conteudo: ReactNode;
  /** "limpar" deste grupo, quando há algo marcado. */
  limpar?: ReactNode;
};

/**
 * Barra de filtros do catálogo (direção "3 — Barra no topo", escolhida pelo
 * dono em 14/10/2026): uma faixa fina sob o título, grudada no topo ao rolar,
 * com "Em promoção" + um botão por grupo (Categoria, Cor…) e a ordenação à
 * direita. A grade fica com a largura inteira.
 *
 * - Computador: o grupo abre numa caixinha logo abaixo do botão; fecha ao
 *   clicar fora, no Esc ou no próprio botão.
 * - Celular: a fileira de botões desliza com o dedo, e o grupo abre numa
 *   FOLHA que sobe de baixo, com "Ver N peças" para fechar.
 *
 * As opções são links (filtro mora na URL, renderizado no servidor). Escolher
 * uma navega e a caixa continua aberta para marcar outra. Vindo de
 * `/masculino` etc., o primeiro filtro leva a `/produtos?…`, que é OUTRA
 * página — o componente remonta; por isso o toque deixa um aviso de vida
 * curta no sessionStorage e a página seguinte reabre o mesmo grupo.
 */
const REABRIR = "uzzo-filtro-aberto";
const REABRIR_JANELA_MS = 15_000;
const DESKTOP = "(min-width: 64rem)";

export function FilterBar({
  promo,
  groups,
  sort,
  total,
}: {
  /** O botão "Em promoção" (um link), ou null onde não faz sentido. */
  promo: ReactNode;
  groups: FilterGroup[];
  sort: ReactNode;
  total: number;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [desktop, setDesktop] = useState(false);
  const barra = useRef<HTMLDivElement>(null);
  const botoes = useRef(new Map<string, HTMLButtonElement>());
  const [esquerda, setEsquerda] = useState(0);

  const fechar = useCallback(() => {
    setAberto(null);
    try {
      sessionStorage.removeItem(REABRIR);
    } catch {}
  }, []);

  // Computador ou celular (decide caixinha × folha).
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const muda = () => setDesktop(mq.matches);
    muda();
    mq.addEventListener("change", muda);
    return () => mq.removeEventListener("change", muda);
  }, []);

  // Reabre o grupo que o cliente estava usando na página anterior.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(REABRIR);
      sessionStorage.removeItem(REABRIR);
      if (!raw) return;
      const { id, t } = JSON.parse(raw) as { id: string; t: number };
      if (Date.now() - t < REABRIR_JANELA_MS && groups.some((g) => g.id === id))
        // Estado vindo do navegador na montagem — não há como ler no render
        // sem divergir do HTML do servidor.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAberto(id);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A caixinha do computador fica alinhada ao botão do grupo (medido; a fila
  // de botões rola na horizontal, então a posição não é fixa).
  useLayoutEffect(() => {
    if (!aberto || !desktop) return;
    const b = botoes.current.get(aberto);
    const base = barra.current?.getBoundingClientRect();
    if (b && base) setEsquerda(b.getBoundingClientRect().left - base.left);
  }, [aberto, desktop]);

  // Computador: clicar fora ou Esc fecha a caixinha.
  useEffect(() => {
    if (!aberto || !desktop) return;
    const fora = (e: MouseEvent) => {
      if (!barra.current?.contains(e.target as Node)) fechar();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("mousedown", fora);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      window.removeEventListener("keydown", esc);
    };
  }, [aberto, desktop, fechar]);

  // Celular: a folha é um modal (trava a rolagem, prende o foco, Esc fecha).
  const folha = useModal<HTMLDivElement>(!!aberto && !desktop, fechar);

  const grupo = groups.find((g) => g.id === aberto);
  const lembra = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a[href]") && aberto)
      try {
        sessionStorage.setItem(
          REABRIR,
          JSON.stringify({ id: aberto, t: Date.now() }),
        );
      } catch {}
  };

  const botao = (ativo: boolean) =>
    `inline-flex h-10 shrink-0 items-center gap-2 rounded-xs border px-3.5 text-sm font-medium transition-colors ${
      ativo ? "border-foreground" : "border-border hover:border-foreground"
    }`;

  return (
    <div
      ref={barra}
      className="sticky top-[var(--header-h)] z-30 -mx-[var(--page-px)] mb-5 border-y border-border bg-background lg:mb-8"
    >
      <div className="px-page flex items-center gap-3 py-2.5">
        <div className="scrollbar-hide -my-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
          {promo}
          {groups.map((g) => {
            const on = aberto === g.id;
            return (
              <button
                key={g.id}
                ref={(el) => {
                  if (el) botoes.current.set(g.id, el);
                }}
                type="button"
                onClick={() => (on ? fechar() : setAberto(g.id))}
                aria-expanded={on}
                aria-haspopup={desktop ? "true" : "dialog"}
                className={botao(on || g.count > 0)}
              >
                {g.rotulo}
                {g.count > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[0.7rem] font-bold text-background">
                    {g.count}
                  </span>
                )}
                <IconChevronDown
                  size={16}
                  className={`text-muted transition-transform duration-200 ${on ? "rotate-180" : ""}`}
                />
              </button>
            );
          })}
        </div>
        <div className="shrink-0 border-l border-border pl-3">{sort}</div>
      </div>

      {/* Computador: caixinha sob o botão do grupo. */}
      {grupo && desktop && (
        <div
          onClickCapture={lembra}
          className="rodape-abre absolute top-full z-30 mt-2 w-80 rounded-sm border border-border bg-background p-4 shadow-lg"
          style={{ left: Math.max(0, esquerda) }}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">{grupo.rotulo}</p>
            {grupo.limpar}
          </div>
          {grupo.conteudo}
        </div>
      )}

      {/* Celular: folha que sobe de baixo. */}
      {grupo && !desktop && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Fechar"
            onClick={fechar}
            className="absolute inset-0 animate-fade-in bg-black/40"
          />
          <div
            ref={folha}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={grupo.rotulo}
            onClickCapture={lembra}
            className="folha-sobe absolute inset-x-0 bottom-0 flex max-h-[80svh] flex-col rounded-t-md bg-background outline-none"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-lg font-bold">
                  {grupo.rotulo}
                </h2>
                {grupo.limpar}
              </div>
              <button
                type="button"
                onClick={fechar}
                aria-label="Fechar"
                className="-m-2 p-2"
              >
                <IconClose />
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-5">{grupo.conteudo}</div>
            <div className="shrink-0 border-t border-border p-4">
              <button
                type="button"
                onClick={fechar}
                className="flex h-12 w-full items-center justify-center rounded-xs bg-foreground text-[0.95rem] font-semibold text-background"
              >
                {total === 0
                  ? "Nenhuma peça com esses filtros"
                  : `Ver ${total} ${total === 1 ? "peça" : "peças"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
