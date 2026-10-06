"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Props = {
  className: string;
  placeholder: string;
  autoFocus?: boolean;
};

/**
 * Campo da busca do cabeçalho, já preenchido com o termo quando o cliente
 * está vendo o resultado (`/produtos?busca=…`) — para corrigir uma letra sem
 * redigitar tudo.
 *
 * `useSearchParams` fica atrás de um `Suspense` de propósito: o cabeçalho está
 * em páginas ESTÁTICAS, e sem a fronteira o Next tornaria a página inteira
 * dinâmica para ler a URL. O `fallback` é o mesmo campo, vazio, no HTML pronto.
 */
export function SearchInput(props: Props) {
  return (
    <Suspense fallback={<Campo {...props} valor="" />}>
      <ComTermo {...props} />
    </Suspense>
  );
}

function ComTermo(props: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const termo = pathname === "/produtos" ? (params.get("busca") ?? "") : "";
  // `key`: busca nova (ou saiu do resultado) troca o valor do campo.
  return <Campo key={termo} {...props} valor={termo} />;
}

function Campo({
  className,
  placeholder,
  autoFocus,
  valor,
}: Props & { valor: string }) {
  return (
    <input
      type="search"
      name="busca"
      defaultValue={valor}
      autoFocus={autoFocus}
      placeholder={placeholder}
      aria-label="Buscar produtos"
      className={className}
    />
  );
}
