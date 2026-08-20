/** Esqueleto da página do produto — mesma lógica do catálogo: estático,
 * feedback imediato enquanto o servidor responde. */
export default function LoadingProduto() {
  return (
    <article className="mx-auto w-full sm:w-[80%] px-6 py-8 md:py-12">
      <div className="mb-6 h-4 w-40 animate-pulse rounded bg-border/60 md:mb-8" />
      <div className="grid gap-10 md:grid-cols-[minmax(0,22rem)_1fr] lg:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="aspect-[3/4] animate-pulse rounded-lg bg-border/60" />
        <div className="space-y-4">
          <div className="h-3 w-24 animate-pulse rounded bg-border/60" />
          <div className="h-9 w-2/3 animate-pulse rounded-md bg-border/60" />
          <div className="h-6 w-32 animate-pulse rounded bg-border/60" />
          <div className="mt-8 h-10 w-56 animate-pulse rounded-full bg-border/60" />
          <div className="h-10 w-64 animate-pulse rounded-md bg-border/60" />
          <div className="mt-6 h-12 w-full max-w-sm animate-pulse rounded-full bg-border/60" />
        </div>
      </div>
    </article>
  );
}
