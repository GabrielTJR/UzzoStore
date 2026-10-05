/**
 * Esqueleto do catálogo — aparece instantaneamente enquanto o servidor monta a
 * página. Estático (zero consulta); melhora a velocidade PERCEBIDA, que no
 * celular é metade da experiência. Segue a mesma grade do `Catalog`, para a
 * página não "pular" quando o conteúdo chega.
 */
export default function LoadingProdutos() {
  return (
    <section className="px-page pb-16 pt-6 lg:pt-10">
      <div className="mb-5 space-y-3 lg:mb-8">
        <div className="h-9 w-44 animate-pulse rounded-xs bg-surface lg:h-12" />
        <div className="h-4 w-28 animate-pulse rounded-xs bg-surface" />
      </div>
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-12">
        <aside className="hidden space-y-6 lg:block">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-4 w-24 animate-pulse rounded-xs bg-surface" />
              <div className="h-3 w-32 animate-pulse rounded-xs bg-surface" />
              <div className="h-3 w-28 animate-pulse rounded-xs bg-surface" />
            </div>
          ))}
        </aside>
        <div>
          <div className="mb-4 h-12 animate-pulse bg-surface lg:hidden" />
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:gap-x-5 lg:gap-y-10 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-[2/3] animate-pulse rounded-xs bg-surface" />
                <div className="h-3 w-3/4 animate-pulse rounded-xs bg-surface" />
                <div className="h-3 w-1/3 animate-pulse rounded-xs bg-surface" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
