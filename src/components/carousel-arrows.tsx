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
 * Por isso a cor é fixa (grafite) com um CONTORNO branco (`contorno` no
 * Chevron): o mesmo traço desenhado antes, em branco e mais grosso. Começou
 * como um halo de `drop-shadow`, mas halo difuso some sobre foto preta (carro,
 * roupa escura na lateral) — o dono não enxergava a seta em 15/10/2026. Um
 * contorno de borda nítida lê nos dois extremos.
 *
 * O foco por teclado ganha um disco branco (`focus-visible:bg-white/85`): sem
 * fundo em repouso, um anel sozinho ficaria invisível sobre a foto.
 *
 * No computador a seta só aparece ao passar o mouse na foto (regra do redesign
 * "Etiqueta"); o foco por teclado a revela mesmo sem hover.
 */
const arrowBtn =
  "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-zinc-900 transition duration-150 ease-out hover:scale-125 active:scale-90 focus-visible:bg-white/85 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/50 lg:opacity-0 lg:group-hover:opacity-100";

/** Ícone compartilhado: o banner da home monta a própria seta, mas usa este. */
export function Chevron({
  dir,
  px = 18,
  contorno = false,
}: {
  dir: "left" | "right";
  px?: number;
  /** Desenha o traço antes em branco e mais grosso, como borda. Para seta que
   * fica sobre FOTO, onde o fundo pode ser de qualquer cor. */
  contorno?: boolean;
}) {
  const d = dir === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6";
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
      {contorno && <path d={d} stroke="white" strokeWidth="5" />}
      <path d={d} />
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
        <Chevron dir="left" px={20} contorno />
      </button>
      <button
        type="button"
        aria-label="Próxima foto"
        onClick={onNext}
        className={`${arrowBtn} right-1`}
      >
        <Chevron dir="right" px={20} contorno />
      </button>
    </>
  );
}
