/**
 * Esqueleto das páginas da conta. As abas (Resumo, Pedidos, Endereços…) são
 * dinâmicas — cada uma lê a sessão e os dados do cliente —, e sem esta tela o
 * clique numa aba não dava sinal nenhum até o servidor responder. Com ela, a
 * troca é imediata: a casca (saudação + abas) fica, e só o miolo pisca até
 * os dados chegarem. O Next também pré-carrega este esqueleto nos links.
 */
export default function LoadingConta() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-xs bg-border/60" />
      <div className="h-4 w-72 max-w-full animate-pulse rounded bg-border/50" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-28 animate-pulse rounded-sm bg-border/40" />
        <div className="h-28 animate-pulse rounded-sm bg-border/40" />
      </div>
      <div className="h-40 animate-pulse rounded-sm bg-border/40" />
    </div>
  );
}
