"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type FooterSecao = { id: string; titulo: string; conteudo: ReactNode };

/**
 * Seções do rodapé no CELULAR (desenho do dono, 07/10/2026): quatro cartões
 * em duas colunas. Tocou num, ele vai sozinho para a coluna da esquerda,
 * aberto, e os outros três DESLIZAM para a coluna da direita. Só um aberto
 * por vez — o rodapé fechado tem ~1/3 da altura do de antes.
 *
 * O deslize é FLIP: mede onde cada cartão está, troca o layout, mede de novo
 * e anima a diferença (Web Animations API, sem biblioteca). Quem pede menos
 * movimento no sistema vê a troca sem animação.
 *
 * Os links também estão no HTML do desktop (colunas abertas), então nada
 * deixa de existir para busca/leitor de tela por estar fechado aqui.
 */
export function FooterSections({ secoes }: { secoes: FooterSecao[] }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const antes = useRef(new Map<string, DOMRect>());

  function trocar(id: string | null) {
    antes.current = new Map(
      [...refs.current].map(([k, el]) => [k, el.getBoundingClientRect()]),
    );
    setAberta(id);
  }

  useLayoutEffect(() => {
    const parado = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!parado)
      for (const [k, el] of refs.current) {
        const a = antes.current.get(k);
        if (!a) continue;
        const b = el.getBoundingClientRect();
        const dx = a.left - b.left;
        const dy = a.top - b.top;
        if (dx || dy)
          el.animate(
            [
              { transform: `translate(${dx}px, ${dy}px)` },
              { transform: "none" },
            ],
            { duration: 600, easing: "cubic-bezier(.65,0,.35,1)" },
          );
      }
    antes.current = new Map();
  }, [aberta]);

  const outras = secoes.filter((s) => s.id !== aberta);
  // Lugar de cada cartão: fechado = 2 × 2; aberto = o escolhido no alto da
  // esquerda e os outros empilhados à direita.
  const lugar = (id: string, i: number) =>
    !aberta
      ? { gridColumn: (i % 2) + 1, gridRow: Math.floor(i / 2) + 1 }
      : id === aberta
        ? { gridColumn: 1, gridRow: 1 }
        : {
            gridColumn: 2,
            gridRow: outras.findIndex((o) => o.id === id) + 1,
          };
  const atual = secoes.find((s) => s.id === aberta);

  return (
    <div
      className="grid items-start gap-2"
      style={{ gridTemplateColumns: aberta ? "1fr auto" : "1fr 1fr" }}
    >
      {secoes.map((s, i) => {
        const on = aberta === s.id;
        return (
          <button
            key={s.id}
            type="button"
            ref={(el) => {
              if (el) refs.current.set(s.id, el);
            }}
            onClick={() => trocar(on ? null : s.id)}
            aria-expanded={on}
            aria-controls={on ? `rodape-${s.id}` : undefined}
            style={lugar(s.id, i)}
            className={`flex min-h-11 items-center justify-between gap-3 rounded-xs border px-3 text-left text-sm font-semibold transition-colors duration-500 ${
              on
                ? "border-white bg-white text-black"
                : aberta
                  ? "border-white/20 text-white/70"
                  : "border-white/20 text-white"
            }`}
          >
            {s.titulo}
            <span
              aria-hidden
              className={on ? "text-black/50" : "text-white/45"}
            >
              {on ? "−" : "+"}
            </span>
          </button>
        );
      })}
      {atual && (
        <div
          key={atual.id}
          id={`rodape-${atual.id}`}
          className="rodape-abre px-1 pt-2 text-sm text-white/65"
          style={{ gridColumn: 1, gridRow: "2 / span 3" }}
        >
          {atual.conteudo}
        </div>
      )}
    </div>
  );
}
