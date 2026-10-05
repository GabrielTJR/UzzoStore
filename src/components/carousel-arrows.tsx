"use client";

const arrowBtn =
  "absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur transition-opacity duration-150 hover:bg-background focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100";

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
        className={`${arrowBtn} left-2`}
      >
        <Chevron dir="left" />
      </button>
      <button
        type="button"
        aria-label="Próxima foto"
        onClick={onNext}
        className={`${arrowBtn} right-2`}
      >
        <Chevron dir="right" />
      </button>
    </>
  );
}
