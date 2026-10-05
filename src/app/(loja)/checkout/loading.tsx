/**
 * Esqueleto do checkout — estático, zero consulta. Aparece no instante do
 * toque em "Finalizar compra" enquanto o servidor lê sessão, perfil e
 * endereços; no celular, tela parada nesse toque parece botão quebrado.
 * Mesma casca da página, para nada "pular" quando o conteúdo chega.
 */
export default function LoadingCheckout() {
  return (
    <section className="mx-auto max-w-2xl px-page py-12" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="h-4 w-36 animate-pulse rounded-xs bg-surface" />
      <div className="mt-4 h-9 w-64 animate-pulse rounded-xs bg-surface" />
      <div className="mt-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 animate-pulse rounded-full bg-surface" />
          <div className="h-5 w-28 animate-pulse rounded-xs bg-surface" />
        </div>
        <div className="h-12 animate-pulse rounded-xs bg-surface" />
        <div className="h-12 animate-pulse rounded-xs bg-surface" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-border pt-5">
            <div className="h-7 w-7 animate-pulse rounded-full bg-surface" />
            <div className="h-5 w-24 animate-pulse rounded-xs bg-surface" />
          </div>
        ))}
      </div>
    </section>
  );
}
