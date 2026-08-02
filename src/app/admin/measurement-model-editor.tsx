"use client";

import { useActionState, useEffect, useState } from "react";
import { saveMeasurementModelAction, type ActionResult } from "./actions";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import type { MeasurementModel } from "@/lib/measurements";

const field =
  "rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground";
const cell =
  "w-28 rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-foreground";

export function MeasurementModelEditor({ model }: { model: MeasurementModel }) {
  const [name, setName] = useState(model.name);
  const [columns, setColumns] = useState<string[]>(model.columns);
  const [rows, setRows] = useState(model.rows);
  const [noteTop, setNoteTop] = useState(model.noteTop ?? "");
  const [noteBottom, setNoteBottom] = useState(model.noteBottom ?? "");

  const [state, action] = useActionState<ActionResult | null, FormData>(
    saveMeasurementModelAction,
    null,
  );
  const { showToast } = useToast();
  useEffect(() => {
    if (state?.ok) showToast("Tabela salva");
    else if (state?.error) showToast(state.error, "error");
  }, [state, showToast]);

  function addColumn() {
    setColumns((c) => [...c, ""]);
    setRows((rs) => rs.map((r) => ({ ...r, values: [...r.values, ""] })));
  }
  function removeColumn(i: number) {
    setColumns((c) => c.filter((_, k) => k !== i));
    setRows((rs) =>
      rs.map((r) => ({ ...r, values: r.values.filter((_, k) => k !== i) })),
    );
  }
  function setColumn(i: number, v: string) {
    setColumns((c) => c.map((x, k) => (k === i ? v : x)));
  }
  function addRow() {
    setRows((rs) => [...rs, { size: "", values: columns.map(() => "") }]);
  }
  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, k) => k !== i));
  }
  function setSize(i: number, v: string) {
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, size: v } : r)));
  }
  function setValue(ri: number, ci: number, v: string) {
    setRows((rs) =>
      rs.map((r, k) =>
        k === ri
          ? { ...r, values: r.values.map((x, j) => (j === ci ? v : x)) }
          : r,
      ),
    );
  }

  const payload = JSON.stringify({ columns, rows, noteTop, noteBottom });

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="modelId" value={model.id} />
      <input type="hidden" name="payload" value={payload} />

      <div className="space-y-1.5">
        <label className="block text-sm font-medium" htmlFor="name">
          Nome do modelo *
        </label>
        <input
          id="name"
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${field} w-full max-w-sm`}
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium">
          Aviso acima da tabela
        </label>
        <textarea
          value={noteTop}
          onChange={(e) => setNoteTop(e.target.value)}
          rows={2}
          placeholder="Ex.: As medidas da tabela são medidas do produto, e não corporais."
          className={`${field} w-full`}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Tabela</p>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="px-1 text-left text-xs font-medium text-muted">
                  Tamanho
                </th>
                {columns.map((col, ci) => (
                  <th key={ci}>
                    <div className="flex items-center gap-1">
                      <input
                        value={col}
                        onChange={(e) => setColumn(ci, e.target.value)}
                        placeholder={`Medida ${ci + 1}`}
                        className={cell}
                      />
                      <button
                        type="button"
                        onClick={() => removeColumn(ci)}
                        title="Remover coluna"
                        aria-label="Remover coluna"
                        className="px-1 text-red-600 hover:opacity-80"
                      >
                        ✕
                      </button>
                    </div>
                  </th>
                ))}
                <th className="px-1">
                  <button
                    type="button"
                    onClick={addColumn}
                    className="rounded-full border border-dashed border-border px-3 py-1 text-xs hover:border-foreground"
                  >
                    + coluna
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  <td>
                    <input
                      value={r.size}
                      onChange={(e) => setSize(ri, e.target.value)}
                      placeholder="P / 38"
                      className={`${cell} font-medium`}
                    />
                  </td>
                  {columns.map((_, ci) => (
                    <td key={ci}>
                      <input
                        value={r.values[ci] ?? ""}
                        onChange={(e) => setValue(ri, ci, e.target.value)}
                        inputMode="decimal"
                        className={cell}
                      />
                    </td>
                  ))}
                  <td className="px-1">
                    <button
                      type="button"
                      onClick={() => removeRow(ri)}
                      title="Remover linha"
                      aria-label="Remover linha"
                      className="px-1 text-red-600 hover:opacity-80"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="mt-2 rounded-full border border-dashed border-border px-4 py-1.5 text-sm hover:border-foreground"
        >
          + tamanho
        </button>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium">
          Aviso abaixo da tabela
        </label>
        <textarea
          value={noteBottom}
          onChange={(e) => setNoteBottom(e.target.value)}
          rows={2}
          placeholder="Ex.: Os tamanhos podem variar 2-3 cm pois são medidos manualmente. Na dúvida, opte pelo maior."
          className={`${field} w-full`}
        />
      </div>

      <div className="flex items-center gap-4">
        <SubmitButton
          pendingText="Salvando…"
          className="h-11 rounded-full bg-foreground px-8 text-sm font-medium text-background hover:opacity-90"
        >
          Salvar tabela
        </SubmitButton>
        {state?.error && (
          <span className="text-sm text-red-600">{state.error}</span>
        )}
      </div>
    </form>
  );
}
