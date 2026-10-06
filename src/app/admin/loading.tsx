/**
 * Esqueleto das telas do painel. Todas são dinâmicas (sessão + consultas com
 * service_role), e sem esta tela o clique no menu lateral ficava parado até
 * o servidor responder. A casca (menu) não é refeita; só a área de trabalho
 * mostra o esqueleto até os dados chegarem.
 */
export default function LoadingPainel() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="mb-6 h-9 w-56 animate-pulse rounded-xs bg-border/60 lg:mb-8" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-28 animate-pulse rounded-sm bg-border/40" />
        <div className="h-28 animate-pulse rounded-sm bg-border/40" />
        <div className="h-28 animate-pulse rounded-sm bg-border/40" />
      </div>
      <div className="mt-6 h-72 animate-pulse rounded-sm bg-border/40" />
    </div>
  );
}
