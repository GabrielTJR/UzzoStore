"use client";

import Image from "next/image";
import { ProductPlaceholder } from "./product-placeholder";

/**
 * Faixa de imagens que desliza horizontalmente conforme `index` (translateX),
 * dando a sensação de carrossel em vez de troca seca. Controlada pelo pai.
 * Dica: passe uma `key` que mude ao trocar a cor, para o deslize não "atravessar"
 * a galeria antiga ao começar do zero numa cor nova.
 */
export function SlideTrack({
  images,
  index,
  alt,
  sizes,
  priority = false,
}: {
  images: string[];
  index: number;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border transition-opacity group-hover:opacity-90">
      {images.length === 0 ? (
        <ProductPlaceholder />
      ) : (
        <div
          className="flex h-full w-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {images.map((url, i) => (
            <div key={`${url}-${i}`} className="relative h-full w-full shrink-0">
              <Image
                src={url}
                alt={images.length > 1 ? `${alt} ${i + 1}` : alt}
                fill
                sizes={sizes}
                priority={priority && i === 0}
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
