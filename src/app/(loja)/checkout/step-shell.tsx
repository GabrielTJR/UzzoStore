import type { ReactNode } from "react";

export type StepEstado = "ativo" | "concluido" | "futuro";

/**
 * Moldura de um passo do checkout: número/marcador, título e, conforme o
 * estado, o conteúdo (ativo), o resumo com "trocar" (concluído) ou só o título
 * apagado (futuro).
 *
 * Os passos ficam numa lista separada por linhas, sem caixa em volta (prévia
 * aprovada pelo dono): no celular a caixa roubaria largura justamente dos
 * campos. O `h2` recebe foco quando o passo vira o ativo (o fluxo cuida disso
 * pelo `id`), por isso `tabIndex={-1}` e `scroll-mt-24` — sem a margem, o
 * cabeçalho da loja cobriria o título ao rolar até ele.
 */
export function StepShell({
  n,
  titulo,
  estado,
  resumo,
  onTrocar,
  trocar,
  children,
}: {
  n: number;
  titulo: string;
  estado: StepEstado;
  resumo?: ReactNode;
  /** "trocar" comum: um botão que reabre o passo. */
  onTrocar?: () => void;
  /** "trocar" sob medida (o passo 1 sai da conta por um `<form>`). */
  trocar?: ReactNode;
  children?: ReactNode;
}) {
  const tituloId = `passo-${n}-titulo`;
  const concluido = estado === "concluido";
  const futuro = estado === "futuro";

  return (
    <li
      className="border-b border-border py-5 first:pt-0"
      aria-labelledby={tituloId}
      aria-current={estado === "ativo" ? "step" : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <h2
          id={tituloId}
          tabIndex={-1}
          className={`flex scroll-mt-24 items-center gap-3 outline-none ${
            futuro ? "opacity-50" : ""
          }`}
        >
          <Marcador n={n} concluido={concluido} />
          <span
            className={
              estado === "ativo"
                ? "font-display text-lg font-bold"
                : "text-base font-medium"
            }
          >
            {titulo}
            {concluido && <span className="sr-only"> (concluído)</span>}
          </span>
        </h2>
        {concluido &&
          (trocar ??
            (onTrocar && (
              <button
                type="button"
                onClick={onTrocar}
                className="-my-2 inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-muted"
              >
                trocar<span className="sr-only"> {titulo.toLowerCase()}</span>
              </button>
            )))}
      </div>

      {concluido && resumo && (
        <div className="mt-1.5 pl-10 text-sm leading-relaxed text-muted">
          {resumo}
        </div>
      )}

      {estado === "ativo" && <div className="mt-5">{children}</div>}
    </li>
  );
}

/** Círculo com o número; concluído vira o acento com um visto — o acento é
 * SINAL na identidade da loja, e "este passo está resolvido" é um sinal. */
function Marcador({ n, concluido }: { n: number; concluido: boolean }) {
  if (concluido)
    return (
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
          <path
            d="M3 8.5l3.2 3L13 4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-foreground text-xs font-medium"
    >
      {n}
    </span>
  );
}
