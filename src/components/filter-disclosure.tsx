"use client";

import { useState } from "react";

/**
 * No mobile, recolhe os filtros atrás de um botão "Filtros (N)"; no desktop
 * (md+) o conteúdo fica sempre visível (o botão some via `md:hidden` e o
 * conteúdo é forçado com `md:block`).
 */
export function FilterDisclosure({
  activeCount,
  children,
}: {
  activeCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-4 flex w-full items-center justify-between rounded-md border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:border-foreground md:hidden"
      >
        <span>Filtros{activeCount > 0 ? ` (${activeCount})` : ""}</span>
        <span aria-hidden className="text-muted">
          {open ? "▲" : "▼"}
        </span>
      </button>
      <div className={`${open ? "block" : "hidden"} md:block`}>{children}</div>
    </div>
  );
}
