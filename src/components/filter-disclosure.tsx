"use client";

import { useState } from "react";

/**
 * No mobile os filtros ficam no topo, recolhidos atrás de "Filtros (N)"; no
 * desktop (md+) o conteúdo aparece sempre — lá cada grupo se recolhe
 * individualmente (ver `FilterSection`).
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
          {open ? "▼" : "▶"}
        </span>
      </button>
      <div className={`${open ? "block" : "hidden"} md:block`}>{children}</div>
    </div>
  );
}
