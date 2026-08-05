"use client";

import { useState } from "react";

/**
 * Um grupo de filtro recolhível (Ofertas, Categoria, Cor…). O título é o
 * botão: seta para baixo quando aberto, para o lado quando fechado.
 * `action` (ex.: link "limpar") fica ao lado do título, fora do botão.
 */
export function FilterSection({
  title,
  action,
  selectedCount = 0,
  defaultOpen = true,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  /** Quantas opções estão marcadas — mostrado como badge quando minimizado. */
  selectedCount?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:text-foreground"
        >
          <span
            aria-hidden
            className="text-[0.6rem] leading-none transition-transform duration-150"
          >
            {open ? "▼" : "▶"}
          </span>
          {title}
          {!open && selectedCount > 0 && (
            <span
              aria-label={`${selectedCount} selecionado(s)`}
              className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[0.6rem] font-semibold tracking-normal text-background"
            >
              {selectedCount}
            </span>
          )}
        </button>
        {open && action}
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}
