"use client";

import { useLinkStatus } from "next/link";

/**
 * Rótulo de um `<Link>` que avisa que o clique foi recebido.
 *
 * Os links de detalhe da audiência têm `prefetch={false}` (cada abertura é uma
 * consulta ao Google; o prefetch dispararia uma para cada card à vista), e por
 * isso nada acontece na tela até o servidor responder. Sem este aviso, o dono
 * clicava, não via reação e clicava de novo — o detalhe parecia travado mesmo
 * quando só estava a caminho.
 *
 * `useLinkStatus` só funciona DENTRO de um `<Link>`: este componente tem de ser
 * descendente dele.
 */
export function RotuloLink({
  children,
  pendente = "abrindo…",
}: {
  children: React.ReactNode;
  pendente?: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <span aria-live="polite" className={pending ? "animate-pulse" : undefined}>
      {pending ? pendente : children}
    </span>
  );
}
