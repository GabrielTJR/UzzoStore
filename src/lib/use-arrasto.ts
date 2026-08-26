"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * Arrastar com o dedo para trocar de slide.
 *
 * Nasceu no banner da home e virou hook quando a mesma coisa passou a valer
 * para as fotos do produto: no celular, passar foto é gesto, não é procurar uma
 * setinha de 32px. Duplicar essa lógica em dois lugares daria dois
 * comportamentos diferentes com o tempo.
 *
 * Decisões que vieram de tropeço, não de gosto:
 *
 * - **Só toque** (`pointerType === "touch"`). Com mouse, arrastar atrapalharia
 *   o clique no link do produto e a seleção de texto.
 * - **Limiar de 10px na horizontal antes de assumir o gesto**, comparando com o
 *   deslocamento vertical. Sem isso o carrossel sequestra a rolagem da página:
 *   quem tentava descer a home ficava preso na foto.
 * - **`touch-action: pan-y` é obrigatório** no elemento que recebe os handlers
 *   (quem usa o hook precisa aplicar), senão o navegador cancela o gesto.
 * - **Elástico de 35% nas pontas**: sem ele, puxar para trás na primeira foto
 *   descobre o fundo vazio da caixa.
 */
export function useArrastoHorizontal({
  ativo,
  indice,
  total,
  aoTrocar,
}: {
  /** Desliga quando só existe um slide. */
  ativo: boolean;
  indice: number;
  total: number;
  aoTrocar: (passo: number) => void;
}) {
  const [arrasto, setArrasto] = useState(0);
  const gesto = useRef<{
    x: number;
    y: number;
    largura: number;
    horizontal: boolean;
  } | null>(null);

  /** Confirma a troca: 12% da largura, nunca menos que 40px. */
  const limiar = (largura: number) => Math.max(40, largura * 0.12);

  function aoPressionar(e: ReactPointerEvent<Element>) {
    if (!ativo || e.pointerType !== "touch") return;
    gesto.current = {
      x: e.clientX,
      y: e.clientY,
      largura: e.currentTarget.clientWidth,
      horizontal: false,
    };
  }

  function aoMover(e: ReactPointerEvent<Element>) {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.horizontal) {
      if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return;
      g.horizontal = true;
    }
    const naPonta = (dx > 0 && indice === 0) || (dx < 0 && indice === total - 1);
    setArrasto(naPonta ? dx * 0.35 : dx);
  }

  function aoSoltar() {
    const g = gesto.current;
    gesto.current = null;
    if (g?.horizontal && Math.abs(arrasto) > limiar(g.largura)) {
      aoTrocar(arrasto < 0 ? 1 : -1);
    }
    setArrasto(0);
  }

  return {
    /** px do gesto em andamento — some no `translateX` junto do índice. */
    arrasto,
    /** Espalhe no elemento que também tem `touch-action: pan-y`. */
    handlers: {
      onPointerDown: aoPressionar,
      onPointerMove: aoMover,
      onPointerUp: aoSoltar,
      onPointerCancel: aoSoltar,
    },
  };
}
