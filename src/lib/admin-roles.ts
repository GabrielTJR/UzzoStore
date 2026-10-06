/**
 * Cargos do painel e o que cada um alcança. Módulo NEUTRO (sem import de
 * servidor): o menu lateral, que é client component, usa a mesma tabela que
 * os guardas das páginas e das server actions — uma regra só, nos dois lados.
 *
 * O menu esconder um item é CONVENIÊNCIA. Quem barra de verdade é
 * `requireArea` (página) e `getAdminFor` (server action), em `lib/admin.ts`.
 */

export type AdminRole = "owner" | "admin" | "vendedor";

export type AdminArea =
  | "visao-geral"
  | "pedidos"
  | "cupons"
  | "produtos"
  | "categorias"
  | "cores"
  | "medidas"
  | "pagina-inicial"
  | "equipe"
  | "logs";

export const CARGOS: Record<AdminRole, { nome: string; descricao: string }> = {
  owner: {
    nome: "Dono",
    descricao: "Tudo, inclusive adicionar e remover pessoas da equipe.",
  },
  admin: {
    nome: "Administrador",
    descricao: "Tudo, menos mexer na equipe.",
  },
  vendedor: {
    nome: "Vendedor",
    descricao:
      "Pedidos e catálogo (produtos, categorias, cores, medidas). Não vê cupons, página inicial (nem os destaques dela), equipe nem o registro de atividades.",
  },
};

/** Cargos que o dono pode dar a alguém (dono não se cria pelo painel). */
export const CARGOS_ATRIBUIVEIS: AdminRole[] = ["admin", "vendedor"];

/**
 * O vendedor atende e cadastra. Ficam de fora o que é decisão do dono:
 * desconto (cupons), a vitrine (página inicial — inclusive marcar DESTAQUES,
 * que é a vitrine da home), quem tem acesso (equipe) e o histórico de quem
 * fez o quê (registro de atividades).
 */
const VENDEDOR: ReadonlySet<AdminArea> = new Set<AdminArea>([
  "visao-geral",
  "pedidos",
  "produtos",
  "categorias",
  "cores",
  "medidas",
]);

export function isAdminRole(v: unknown): v is AdminRole {
  return v === "owner" || v === "admin" || v === "vendedor";
}

/** Cargo desconhecido (valor novo no banco, por exemplo) vale como vendedor:
 * na dúvida, o acesso menor. */
export function podeAcessar(
  role: AdminRole | string,
  area: AdminArea,
): boolean {
  if (role === "owner" || role === "admin") return true;
  return VENDEDOR.has(area);
}
