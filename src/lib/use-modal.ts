"use client";

import { useEffect, useRef } from "react";

/**
 * Comportamento de modal para gavetas (menu, filtros, menu do painel): trava o
 * scroll da página, foca o painel ao abrir, prende o Tab dentro dele, fecha no
 * Esc e DEVOLVE o foco a quem abriu. É a mesma receita da gaveta da sacola —
 * sem ela, quem navega por teclado ou leitor de tela cai atrás do overlay.
 *
 * Devolve a `ref` para pôr no painel (que precisa de `tabIndex={-1}`).
 */
export function useModal<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      before?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const panel = ref.current;
      if (e.key !== "Tab" || !panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return ref;
}
