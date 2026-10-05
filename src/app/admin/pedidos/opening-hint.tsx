"use client";

import { useLinkStatus } from "next/link";

/**
 * Resposta ao clique no cartão do quadro, enquanto o pedido abre.
 *
 * O link do cartão vai sem prefetch (regra de custo do painel) e a tela é
 * dinâmica, então entre o clique e o modal existe uma ida ao servidor. Sem
 * sinal nenhum nesse intervalo o cartão parece morto e leva um segundo clique.
 *
 * É um véu sobre o cartão inteiro, sempre renderizado e só com a opacidade
 * mudando — não empurra nada de lugar. O atraso evita o pisca quando o pedido
 * abre rápido. Precisa ficar DENTRO do `<Link>`: é assim que `useLinkStatus`
 * sabe de qual link se trata.
 */
export function OpeningHint() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-20 rounded-xs bg-background transition-opacity delay-150 ${
        pending ? "opacity-60" : "opacity-0"
      }`}
    />
  );
}
