"use client";

import { useRouter } from "next/navigation";
import type { SortKey } from "@/lib/product-sort";
import { marcaFiltrando } from "@/lib/filtrando";

/**
 * Ordenação da vitrine. Vive na URL (junto de filtros e busca), então o
 * resultado é compartilhável e o "voltar" do navegador funciona.
 *
 * Os endereços vêm PRONTOS do servidor (`options[].href`), já com os filtros
 * atuais e a página zerada — a página 3 da ordem antiga não corresponde à
 * nova. Antes este componente remontava a URL a partir da query do navegador,
 * o que perdia o departamento nas páginas de endereço limpo (/masculino não
 * tem query para ler).
 */
export function SortSelect({
  value,
  options,
  compacto = false,
}: {
  value: SortKey;
  options: { key: SortKey; label: string; href: string }[];
  /** Celular: um botão "Ordenar ▾" do tamanho dos filtros, com o seletor
   * nativo por cima (invisível) — o toque abre a lista do próprio celular.
   * A versão larga espremia os filtros num canto da barra. */
  compacto?: boolean;
}) {
  const router = useRouter();
  const ir = (key: string) => {
    const next = options.find((o) => o.key === key);
    if (!next) return;
    marcaFiltrando();
    router.push(next.href, { scroll: false, transitionTypes: ["filtro"] });
  };

  if (compacto)
    return (
      <label className="relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xs border border-border px-3.5 text-sm font-medium focus-within:ring-2 focus-within:ring-accent">
        Ordenar
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          width="14"
          height="14"
          className="text-muted"
        >
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
        <select
          value={value}
          onChange={(e) => ir(e.target.value)}
          aria-label="Ordenar produtos"
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );

  return (
    <label className="flex w-full min-w-0 items-center justify-center gap-1.5 px-3 text-sm lg:w-auto lg:gap-2 lg:px-0">
      <span className="shrink-0 font-semibold lg:font-normal lg:text-muted">
        Ordenar
      </span>
      <select
        value={value}
        onChange={(e) => ir(e.target.value)}
        aria-label="Ordenar produtos"
        className="min-w-0 flex-1 truncate rounded-xs border-0 bg-transparent py-1.5 text-sm text-muted outline-none focus-visible:ring-2 focus-visible:ring-accent lg:flex-none lg:border lg:border-border lg:px-3 lg:py-2 lg:text-foreground lg:focus:border-foreground"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
