"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Busca por nome do produto. Submete navegando (a busca vive na URL, junto
 * com os filtros), então dá para compartilhar e voltar pelo histórico.
 * Trocar a busca zera a paginação — senão cairia numa página que não existe
 * para o novo resultado.
 */
export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [term, setTerm] = useState(params.get("busca") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params.toString());
    const clean = term.trim();
    if (clean) next.set("busca", clean);
    else next.delete("busca");
    next.delete("pagina");
    const qs = next.toString();
    router.push(qs ? `/produtos?${qs}` : "/produtos", { scroll: false });
  }

  return (
    <form onSubmit={submit} className="relative">
      <input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Buscar peça…"
        aria-label="Buscar produtos"
        className="w-full rounded-full border border-border bg-transparent py-2 pl-4 pr-10 text-sm outline-none focus:border-foreground"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:text-foreground"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </button>
    </form>
  );
}
