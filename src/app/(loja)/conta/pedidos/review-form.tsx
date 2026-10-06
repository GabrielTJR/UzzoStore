"use client";

import { useState, useTransition } from "react";
import { submitReviewAction } from "../review-actions";

/**
 * Avaliar uma peça (pedido entregue). Fechado vira um link "Avaliar"; aberto,
 * estrelas + comentário opcional. Depois de enviada mostra a nota e que ela
 * passa por aprovação — o cliente não fica achando que sumiu.
 */
export function ReviewForm({
  orderId,
  productId,
  atual,
}: {
  orderId: string;
  productId: string;
  /** Avaliação que o cliente já mandou (para mostrar ou editar). */
  atual?: { rating: number; status: string } | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState(atual?.rating ?? 0);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(atual ?? null);
  const [pendente, start] = useTransition();

  if (!aberto)
    return (
      <div className="mt-1 text-sm">
        {enviada ? (
          <p className="text-muted">
            Sua nota: <Estrelas valor={enviada.rating} />{" "}
            {enviada.status === "published"
              ? "(publicada)"
              : enviada.status === "hidden"
                ? "(não publicada)"
                : "(aguardando aprovação)"}{" "}
            <button
              type="button"
              onClick={() => setAberto(true)}
              className="underline underline-offset-4 hover:text-foreground"
            >
              editar
            </button>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="inline-flex min-h-9 items-center font-medium underline underline-offset-4"
          >
            Avaliar esta peça
          </button>
        )}
      </div>
    );

  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!nota) {
          setErro("Escolha de 1 a 5 estrelas.");
          return;
        }
        start(async () => {
          setErro(null);
          const r = await submitReviewAction({
            orderId,
            productId,
            rating: nota,
            body: texto,
          });
          if (!r.ok) {
            setErro(r.error ?? "Não foi possível enviar.");
            return;
          }
          setEnviada({ rating: nota, status: "pending" });
          setAberto(false);
        });
      }}
    >
      <div role="radiogroup" aria-label="Nota" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={nota === n}
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
            onClick={() => setNota(n)}
            className={`flex h-10 w-10 items-center justify-center text-2xl leading-none ${
              n <= nota ? "text-accent" : "text-border"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="Conte como foi (tecido, tamanho, caimento) — opcional"
        className="w-full rounded-xs border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground"
      />
      {erro && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pendente}
          className="h-10 rounded-xs bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-60"
        >
          {pendente ? "Enviando…" : "Enviar avaliação"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-sm text-muted hover:text-foreground"
        >
          Cancelar
        </button>
      </div>
      <p className="text-xs text-muted">
        Aparece na página da peça depois de aprovada pela loja, com seu primeiro
        nome e a inicial do sobrenome.
      </p>
    </form>
  );
}

export function Estrelas({ valor }: { valor: number }) {
  const cheias = Math.round(valor);
  return (
    <span
      aria-label={`${valor.toFixed(1).replace(".", ",")} de 5`}
      className="text-accent"
    >
      {"★".repeat(cheias)}
      <span className="text-border">{"★".repeat(5 - cheias)}</span>
    </span>
  );
}
