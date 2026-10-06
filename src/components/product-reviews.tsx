import type { ProductReviews } from "@/lib/reviews";

const data = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });

function Estrelas({
  valor,
  grande = false,
}: {
  valor: number;
  grande?: boolean;
}) {
  const cheias = Math.round(valor);
  return (
    <span
      role="img"
      aria-label={`${valor.toFixed(1).replace(".", ",")} de 5 estrelas`}
      className={`tracking-[0.1em] text-accent ${grande ? "text-xl" : "text-sm"}`}
    >
      {"★".repeat(cheias)}
      <span className="text-border">{"★".repeat(5 - cheias)}</span>
    </span>
  );
}

/**
 * Avaliações da peça (só as aprovadas no painel). Sem nenhuma, a seção não
 * aparece — "0 avaliações" numa loja nova só tira confiança.
 */
export function ProductReviewsSection({
  reviews,
}: {
  reviews: ProductReviews;
}) {
  if (reviews.total === 0) return null;
  return (
    <section
      aria-labelledby="avaliacoes-titulo"
      className="mt-12 border-t border-border pt-8 lg:mt-16"
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2
          id="avaliacoes-titulo"
          className="font-display text-xl font-bold lg:text-2xl"
        >
          Avaliações
        </h2>
        <p className="flex items-center gap-2 text-sm">
          <Estrelas valor={reviews.media} grande />
          <span className="font-semibold">
            {reviews.media.toFixed(1).replace(".", ",")}
          </span>
          <span className="text-muted">
            ({reviews.total} {reviews.total === 1 ? "avaliação" : "avaliações"})
          </span>
        </p>
      </div>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {reviews.itens.map((r, i) => (
          <li key={i} className="rounded-sm border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <Estrelas valor={r.rating} />
              <span className="text-xs text-muted">{data(r.createdAt)}</span>
            </div>
            {r.body && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                {r.body}
              </p>
            )}
            <p className="mt-2 text-xs text-muted">
              {r.author} <span aria-hidden>✓</span> comprou esta peça
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
