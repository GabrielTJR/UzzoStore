/**
 * Endereço do Registro de atividades — módulo NEUTRO (sem import de servidor),
 * usado pelo servidor e pelo formulário.
 *
 * Todo o estado da tela vive na URL (filtros, página e o evento aberto no
 * modal). Montar num lugar só é o que impede abrir um evento e perder o
 * filtro, ou trocar de página e fechar o período escolhido.
 */
export type LogsBusca = {
  area?: string | null;
  quem?: string | null;
  periodo?: string | null;
  busca?: string | null;
  auto?: boolean;
  pagina?: number;
  evento?: number | null;
};

/** Período padrão — quando é este, fica fora da URL. */
export const PERIODO_PADRAO_URL = "7";

export function logsHref(base: LogsBusca, mudar: LogsBusca = {}): string {
  const s = { ...base, ...mudar };
  const q = new URLSearchParams();
  if (s.area) q.set("area", s.area);
  if (s.quem) q.set("quem", s.quem);
  if (s.periodo && s.periodo !== PERIODO_PADRAO_URL) q.set("periodo", s.periodo);
  if (s.busca) q.set("busca", s.busca);
  if (s.auto) q.set("auto", "1");
  if (s.pagina && s.pagina > 1) q.set("pagina", String(s.pagina));
  if (s.evento) q.set("evento", String(s.evento));
  const query = q.toString();
  return query ? `/admin/logs?${query}` : "/admin/logs";
}
