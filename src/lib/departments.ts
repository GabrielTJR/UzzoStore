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
 * ⚠️ CHAVE DA MIGRAÇÃO 0022. Enquanto for `false`, o código NÃO toca na coluna
 * `products.department`: o catálogo inteiro conta como masculino (é o que ele
 * é hoje), o Feminino fica "em breve" e o campo Departamento não aparece no
 * cadastro de produto.
 *
 * Existe porque o código foi escrito antes de a migração ser aplicada no banco,
 * e pedir uma coluna que não existe derruba TODA a listagem (o PostgREST
 * recusa a consulta inteira). Depois de aplicar
 * `supabase/migrations/*_0022_departamento.sql`, troque para `true` — é a
 * única mudança necessária.
 */
export const DEPARTMENT_COLUMN_READY = false;
