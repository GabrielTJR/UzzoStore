/**
 * Tabela de medidas (modelos reutilizáveis). Tipos compartilhados + helpers de
 * normalização do jsonb (columns/rows) para vitrine e admin.
 */

export type MeasurementRow = { size: string; values: string[] };

/** Uma tabela de medidas pronta para exibir. */
export type MeasurementChart = {
  name: string;
  columns: string[];
  rows: MeasurementRow[];
  noteTop: string | null;
  noteBottom: string | null;
};

/** Modelo do cadastro (chart + id). */
export type MeasurementModel = MeasurementChart & { id: string };

/** Opção enxuta para selects. */
export type MeasurementModelOption = { id: string; name: string };

/** Colunas (string[]) a partir do jsonb. */
export function parseColumns(value: unknown): string[] {
  return Array.isArray(value) ? value.map((c) => String(c ?? "")) : [];
}

/**
 * Linhas ([{size, values[]}]) a partir do jsonb, alinhando `values` ao número
 * de colunas (preenche/apara) para a tabela ficar sempre retangular.
 */
export function parseRows(value: unknown, columnCount: number): MeasurementRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((r) => {
    const row = (r ?? {}) as { size?: unknown; values?: unknown };
    const size = String(row.size ?? "");
    const raw = Array.isArray(row.values) ? row.values : [];
    const values = Array.from({ length: columnCount }, (_, i) =>
      String(raw[i] ?? ""),
    );
    return { size, values };
  });
}

/** Monta um MeasurementChart a partir dos campos crus do banco. */
export function toChart(m: {
  name: string;
  columns: unknown;
  rows: unknown;
  note_top: string | null;
  note_bottom: string | null;
}): MeasurementChart {
  const columns = parseColumns(m.columns);
  return {
    name: m.name,
    columns,
    rows: parseRows(m.rows, columns.length),
    noteTop: m.note_top,
    noteBottom: m.note_bottom,
  };
}
