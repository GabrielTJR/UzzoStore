/** Esqueleto da página do produto — mesma lógica do catálogo: estático,
 * feedback imediato enquanto o servidor responde. */
export default function LoadingProduto() {
  return (
    <article className="px-page pb-10 pt-4 md:py-10">
      <div className="mb-6 h-4 w-40 animate-pulse rounded bg-border/60 md:mb-8" />
      <div className="grid gap-6 md:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] md:gap-10 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-14">
        <div className="-mx-[var(--page-px)] aspect-[2/3] animate-pulse bg-border/60 md:mx-0 lg:w-[clamp(20rem,calc((100svh-var(--header-h)-7rem)*2/3),38rem)]" />
        <div className="space-y-4">
          <div className="h-3 w-24 animate-pulse rounded bg-border/60" />
          <div className="h-9 w-2/3 animate-pulse rounded-xs bg-border/60" />
          <div className="h-6 w-32 animate-pulse rounded bg-border/60" />
          <div className="mt-8 h-10 w-56 animate-pulse rounded-xs bg-border/60" />
          <div className="h-10 w-64 animate-pulse rounded-xs bg-border/60" />
          <div className="mt-6 h-12 w-full max-w-sm animate-pulse rounded-xs bg-border/60" />
        </div>
      </div>
    </article>
  );
}
