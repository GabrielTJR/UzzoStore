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
  // Passar o mouse NÃO troca a foto. A "espiada" (peek) existiu até 20/08/2026
  // e saiu a pedido do dono da loja. Só a seta e a bolinha de cor mudam a
  // imagem — quem passa o mouse pela grade não vê nada se mexer sozinho.

  const active = colors[colorIdx];
  const gallery = active?.images ?? [];
  const multi = gallery.length > 1;

  function selectColor(i: number) {
    setColorIdx(i);
    setPhotoIdx(0);
  }

  function step(delta: number) {
    setPhotoIdx((p) => (p + delta + gallery.length) % gallery.length);
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
            // 5 colunas + a lateral de filtros a partir de 1536px: ~18vw.
            sizes="(min-width: 1536px) 18vw, (max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
          />
        </Link>
        {badge}
        {multi && (
          <CarouselArrows onPrev={() => step(-1)} onNext={() => step(1)} />
        )}
      </div>

      {colors.length > 1 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
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
                // A bolinha tem 16px, mas a ÁREA de toque tem 28px (padding com
                // margem negativa): 16px é pequeno demais para o polegar.
                className="-m-1.5 p-1.5"
              >
                <span
                  aria-hidden
                  className={`block h-4 w-4 rounded-full border ${
                    isSelected
                      ? "border-foreground ring-1 ring-foreground ring-offset-2 ring-offset-background"
                      : "border-foreground/25"
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
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
