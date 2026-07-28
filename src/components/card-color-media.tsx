"use client";

import { useState } from "react";
import Link from "next/link";
import { SlideTrack } from "./slide-track";
import { CarouselArrows } from "./carousel-arrows";
import type { ProductListItem } from "@/lib/products";

export function CardColorMedia({ product }: { product: ProductListItem }) {
  const colors = product.colors;
  // Começa na 1ª cor que tem foto (para o anel bater com a imagem exibida).
  const firstWithImage = colors.findIndex((c) => c.images.length > 0);
  const [colorIdx, setColorIdx] = useState(
    firstWithImage < 0 ? 0 : firstWithImage,
  );
  const [photoIdx, setPhotoIdx] = useState(0);

  const active = colors[colorIdx];
  const gallery = active?.images ?? [];
  const multi = gallery.length > 1;

  function selectColor(i: number) {
    setColorIdx(i);
    setPhotoIdx(0);
  }

  return (
    <>
      <div className="relative">
        <Link href={`/produtos/${product.slug}`} className="block">
          <SlideTrack
            key={colorIdx}
            images={gallery}
            index={photoIdx}
            alt={active ? `${product.name} — ${active.name}` : product.name}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </Link>
        {multi && (
          <CarouselArrows
            onPrev={() =>
              setPhotoIdx((p) => (p - 1 + gallery.length) % gallery.length)
            }
            onNext={() => setPhotoIdx((p) => (p + 1) % gallery.length)}
          />
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
                title={c.name}
                aria-label={`Ver cor ${c.name}`}
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
