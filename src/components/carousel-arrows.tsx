"use client";

const arrowBtn =
  "absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-sm backdrop-blur transition duration-150 ease-out hover:scale-110 hover:bg-background active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40";

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
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
