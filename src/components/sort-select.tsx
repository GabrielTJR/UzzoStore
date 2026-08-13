"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SORT_OPTIONS, type SortKey } from "@/lib/product-sort";

/**
 * Ordenação da vitrine. Vive na URL (junto de filtros e busca), então o
 * resultado é compartilhável e o "voltar" do navegador funciona. Trocar a
 * ordem zera a página — a página 3 da ordem antiga não corresponde à nova.
 */
export function SortSelect({ value }: { value: SortKey }) {
  const router = useRouter();
  const params = useSearchParams();

  function change(next: string) {
    const p = new URLSearchParams(params.toString());
    if (next === "categoria") p.delete("ordem");
    else p.set("ordem", next);
    p.delete("pagina");
    const qs = p.toString();
    router.push(qs ? `/produtos?${qs}` : "/produtos", { scroll: false });
  }

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden
        className="shrink-0"
      >
        <path d="M3 6h18M6 12h12M10 18h4" />
      </svg>
      <span className="sr-only sm:not-sr-only">Ordenar por</span>
      <select
        value={value}
        onChange={(e) => change(e.target.value)}
        aria-label="Ordenar produtos"
        className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm text-foreground outline-none focus:border-foreground"
      >
        {(Object.keys(SORT_OPTIONS) as SortKey[]).map((k) => (
          <option key={k} value={k}>
            {SORT_OPTIONS[k]}
          </option>
        ))}
      </select>
    </label>
  );
}
