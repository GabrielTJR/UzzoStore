"use client";

import { useState } from "react";
import type { MeasurementChart } from "@/lib/measurements";

export function MeasurementTable({ chart }: { chart: MeasurementChart }) {
  const [open, setOpen] = useState(false);
  const hasTable = chart.columns.length > 0 && chart.rows.length > 0;
  if (!hasTable && !chart.noteTop && !chart.noteBottom) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-muted underline underline-offset-4 transition-colors hover:text-foreground"
      >
        <span aria-hidden>📏</span> Tabela de medidas
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Tabela de medidas"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-auto rounded-lg border border-border bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-serif text-xl font-semibold">
                Tabela de medidas
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-border hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {chart.noteTop && (
              <p className="mb-4 text-sm text-muted">{chart.noteTop}</p>
            )}

            {hasTable && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 pr-3 text-left font-medium">Tam.</th>
                      {chart.columns.map((c, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chart.rows.map((r, ri) => (
                      <tr key={ri} className="border-b border-border/60">
                        <td className="py-2 pr-3 font-medium">{r.size}</td>
                        {chart.columns.map((_, ci) => (
                          <td key={ci} className="px-3 py-2 text-muted">
                            {r.values[ci] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {chart.noteBottom && (
              <p className="mt-4 text-xs leading-relaxed text-muted">
                {chart.noteBottom}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
