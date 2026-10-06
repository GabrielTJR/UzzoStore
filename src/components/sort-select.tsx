"use client";

import { useRouter } from "next/navigation";
import type { SortKey } from "@/lib/product-sort";

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
}: {
  value: SortKey;
  options: { key: SortKey; label: string; href: string }[];
}) {
  const router = useRouter();

  return (
    <label className="flex w-full min-w-0 items-center justify-center gap-1.5 px-3 text-sm lg:w-auto lg:gap-2 lg:px-0">
      <span className="shrink-0 font-semibold lg:font-normal lg:text-muted">
        Ordenar
      </span>
      <select
        value={value}
        onChange={(e) => {
          const next = options.find((o) => o.key === e.target.value);
          if (next) router.push(next.href, { scroll: false });
        }}
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
