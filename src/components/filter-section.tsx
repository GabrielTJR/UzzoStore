"use client";

import { useState } from "react";
import { IconChevronDown } from "@/components/icons";

/**
 * Um grupo de filtro recolhível (Ofertas, Categoria, Cor…). O título é o
 * botão; a seta gira quando fecha. `action` (ex.: link "limpar") fica ao lado
 * do título, fora do botão.
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
    <div className="border-b border-border py-4 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 py-1 text-left text-sm font-semibold"
        >
          {title}
          {!open && selectedCount > 0 && (
            <span
              aria-label={`${selectedCount} selecionado(s)`}
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[0.7rem] font-bold text-background"
            >
              {selectedCount}
            </span>
          )}
        </button>
        {open && action}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => setOpen((o) => !o)}
          className="-mr-1 p-1 text-muted"
        >
          <IconChevronDown
            size={18}
            className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
