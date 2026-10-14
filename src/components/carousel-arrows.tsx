"use client";

/**
 * Seta de carrossel: SÓ o chevron, sem pílula atrás.
 *
 * Havia um círculo (`bg-background/80` + borda + sombra) por trás da seta. Ele
 * resolvia o contraste, mas no tema escuro virava uma bolha preta sobre a foto
 * clara do produto — peso visual justamente no elemento que deveria sumir e
 * deixar a peça aparecer. Saiu a pedido do dono da loja em 05/09/2026.
 *
 * ⚠️ A cor do chevron NÃO pode vir do tema. Ele fica sobre a FOTO, e foto não
 * muda com o tema: um `text-foreground` viraria branco no modo escuro e
 * desapareceria no fundo claro de estúdio que quase todas as nossas fotos têm.
 * Por isso a cor é fixa (grafite) com um halo branco no `drop-shadow` — lê no
 * fundo claro e continua legível quando uma peça escura ocupa a lateral.
 *
 * O foco por teclado ganha um disco branco (`focus-visible:bg-white/85`): sem
 * fundo em repouso, um anel sozinho ficaria invisível sobre a foto.
 *
 * No computador a seta só aparece ao passar o mouse na foto (regra do redesign
 * "Etiqueta"); o foco por teclado a revela mesmo sem hover.
 */
const arrowBtn =
  "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-zinc-900 transition duration-150 ease-out hover:scale-125 active:scale-90 focus-visible:bg-white/85 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/50 [&>svg]:drop-shadow-[0_0_3px_rgba(255,255,255,0.95)] lg:opacity-0 lg:group-hover:opacity-100";

/** Ícone compartilhado: o banner da home monta a própria seta, mas usa este. */
export function Chevron({ dir, px = 18 }: { dir: "left" | "right"; px?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={px}
      height={px}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {dir === "left" ? (
        <path d="M15 18l-6-6 6-6" />
      ) : (
        <path d="M9 18l6-6-6-6" />
      )}
    </svg>
  );
}

/** Setas de carrossel (anterior/próxima) sobrepostas nas laterais da imagem. */
export function CarouselArrows({
  onPrev,
  onNext,
}: {
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Foto anterior"
        onClick={onPrev}
        className={`${arrowBtn} left-1`}
      >
        <Chevron dir="left" px={20} />
      </button>
      <button
        type="button"
        aria-label="Próxima foto"
        onClick={onNext}
        className={`${arrowBtn} right-1`}
      >
        <Chevron dir="right" px={20} />
      </button>
    </>
  );
}
