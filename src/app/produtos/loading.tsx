/**
 * Esqueleto do catálogo — aparece instantaneamente enquanto o servidor monta a
 * página. Estático (zero consulta); melhora a velocidade PERCEBIDA, que no
 * celular é metade da experiência.
 */
export default function LoadingProdutos() {
  return (
    <section className="mx-auto w-full sm:w-[80%] px-6 pb-12 pt-6">
      <div className="mb-6 space-y-3">
        <div className="h-9 w-44 animate-pulse rounded-md bg-border/60" />
        <div className="h-4 w-28 animate-pulse rounded bg-border/60" />
      </div>
      <div className="md:grid md:grid-cols-[13rem_1fr] md:gap-10">
        <aside className="mb-8 hidden space-y-4 md:block">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-border/60" />
              <div className="h-3 w-32 animate-pulse rounded bg-border/60" />
              <div className="h-3 w-28 animate-pulse rounded bg-border/60" />
            </div>
          ))}
        </aside>
        <div>
          <div className="mb-6 h-10 w-full max-w-md animate-pulse rounded-full bg-border/60" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-[3/4] animate-pulse rounded-lg bg-border/60" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-border/60" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-border/60" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
