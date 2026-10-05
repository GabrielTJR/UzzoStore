/**
 * Departamentos da loja (Masculino / Feminino) — módulo NEUTRO, sem imports de
 * servidor: o cabeçalho é client component e usa estes nomes.
 *
 * O departamento é um campo do PRODUTO (`products.department`, migração 0022):
 * "masculino", "feminino" ou "unissex" — este último aparece nos dois.
 */
export const DEPARTMENTS = {
  masculino: "Masculino",
  feminino: "Feminino",
} as const;

export type Department = keyof typeof DEPARTMENTS;

/** Valores aceitos na coluna (os dois departamentos + unissex). */
export const DEPARTMENT_VALUES = ["masculino", "feminino", "unissex"] as const;
export type DepartmentValue = (typeof DEPARTMENT_VALUES)[number];

export const DEPARTMENT_VALUE_LABELS: Record<DepartmentValue, string> = {
  masculino: "Masculino",
  feminino: "Feminino",
  unissex: "Unissex",
};

export function isDepartment(v: unknown): v is Department {
  return typeof v === "string" && v in DEPARTMENTS;
}

export function isDepartmentValue(v: unknown): v is DepartmentValue {
  return (
    typeof v === "string" &&
    (DEPARTMENT_VALUES as readonly string[]).includes(v)
  );
}

/**
 * CHAVE DA MIGRAÇÃO 0022 (`products.department`). Está `true` desde
 * 05/10/2026: o dono aplicou o SQL no banco de produção e a coluna foi
 * conferida pela API (30 produtos, todos "masculino").
 *
 * Continua existindo como constante por um motivo só: um banco que NÃO tenha
 * a migração (projeto novo, branch de preview do Supabase) derruba TODA a
 * listagem se o código pedir a coluna — o PostgREST recusa a consulta inteira.
 * Nesse caso, `false` faz o código não tocar nela: o catálogo inteiro conta
 * como masculino, o Feminino fica "em breve" e o campo some do cadastro.
 */
export const DEPARTMENT_COLUMN_READY = true;
