"use client";

import { useState } from "react";
import Link from "next/link";
import { SlideTrack } from "./slide-track";
import { CarouselArrows } from "./carousel-arrows";
import type { ProductListItem } from "@/lib/products";
import { displayColor } from "@/lib/color-name";

export function CardColorMedia({
  product,
  badge,
}: {
  product: ProductListItem;
  badge?: React.ReactNode;
}) {
  const colors = product.colors;
  // Começa na 1ª cor que tem foto (para o anel bater com a imagem exibida).
  const firstWithImage = colors.findIndex((c) => c.images.length > 0);
  const [colorIdx, setColorIdx] = useState(
    firstWithImage < 0 ? 0 : firstWithImage,
  );
  const [photoIdx, setPhotoIdx] = useState(0);
  // Espiada no hover (desktop): mostra a 2ª foto sem clique — a foto já veio
  // no payload do card, então não custa nada. O peek DESLIGA no primeiro uso
  // das setas (`navigated`): sem isso ele viraria um índice paralelo e o
  // clique nas setas não mudaria a foto exibida (as setas ficariam "mortas"
  // numa galeria de 2 fotos). As setas partem do índice EXIBIDO (`shownIdx`),
  // senão o primeiro clique só "confirmaria" a foto que o peek já mostrava.
  const [peek, setPeek] = useState(false);
  const [navigated, setNavigated] = useState(false);

  const active = colors[colorIdx];
  const gallery = active?.images ?? [];
  const multi = gallery.length > 1;
  const shownIdx = peek && multi && !navigated && photoIdx === 0 ? 1 : photoIdx;

  function selectColor(i: number) {
    setColorIdx(i);
    setPhotoIdx(0);
    setNavigated(false);
  }

  function step(delta: number) {
    setNavigated(true);
    setPhotoIdx((shownIdx + delta + gallery.length) % gallery.length);
  }

  return (
    <>
      <div
        className="relative"
        onMouseEnter={() => setPeek(true)}
        onMouseLeave={() => setPeek(false)}
      >
        <Link href={`/produtos/${product.slug}`} className="block">
          <SlideTrack
            key={colorIdx}
            images={gallery}
            index={shownIdx}
            alt={active ? `${product.name} — ${active.name}` : product.name}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </Link>
        {badge}
        {multi && (
          <CarouselArrows onPrev={() => step(-1)} onNext={() => step(1)} />
        )}
      </div>

      {colors.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {colors.map((c, i) => {
            const isSelected = i === colorIdx;
            return (
              <button
                key={`${c.name}-${i}`}
                type="button"
                onClick={() => selectColor(i)}
                title={displayColor(c.name)}
                aria-label={`Ver cor ${displayColor(c.name)}`}
                aria-pressed={isSelected}
                className={`h-5 w-5 rounded-full border transition duration-150 ease-out ${
                  isSelected
                    ? "border-foreground ring-2 ring-foreground ring-offset-2 ring-offset-background"
                    : "border-border hover:scale-110"
                }`}
                style={
                  c.hex
                    ? { backgroundColor: c.hex }
                    : {
                        backgroundImage:
                          "repeating-linear-gradient(45deg, var(--color-border, #ccc) 0 3px, transparent 3px 6px)",
                      }
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
}
