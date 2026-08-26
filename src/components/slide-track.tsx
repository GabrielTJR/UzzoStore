"use client";

import Image from "next/image";
import { ProductPlaceholder } from "./product-placeholder";
import { useArrastoHorizontal } from "@/lib/use-arrasto";

/**
 * Faixa de imagens que desliza horizontalmente conforme `index` (translateX),
 * dando a sensação de carrossel em vez de troca seca. Controlada pelo pai.
 * Dica: passe uma `key` que mude ao trocar a cor, para o deslize não "atravessar"
 * a galeria antiga ao começar do zero numa cor nova.
 *
 * Com `onArrastar`, o dedo passa a trocar a foto no celular — no telefone é
 * assim que se espera passar imagem, e a seta de 32px é alvo pequeno demais
 * para o polegar. A lógica mora em `lib/use-arrasto.ts`, a mesma do banner da
 * home. Sem `onArrastar` o componente segue só controlado (o card usa assim
 * quando não faz sentido arrastar).
 */
export function SlideTrack({
  images,
  index,
  alt,
  sizes,
  priority = false,
  onArrastar,
}: {
  images: string[];
  index: number;
  alt: string;
  sizes: string;
  priority?: boolean;
  /** Recebe -1 ou 1 quando o gesto passa do limiar. */
  onArrastar?: (passo: number) => void;
}) {
  const { arrasto, handlers } = useArrastoHorizontal({
    ativo: !!onArrastar && images.length > 1,
    indice: index,
    total: images.length,
    aoTrocar: (passo) => onArrastar?.(passo),
  });

  return (
    <div
      className={`relative aspect-[3/4] overflow-hidden rounded-lg border border-border transition-opacity group-hover:opacity-90 ${
        onArrastar ? "touch-pan-y" : ""
      }`}
      {...(onArrastar ? handlers : {})}
    >
      {images.length === 0 ? (
        <ProductPlaceholder />
      ) : (
        <div
          className="flex h-full w-full transition-transform duration-300 ease-out"
          style={{
            transform: `translateX(calc(${-index * 100}% + ${arrasto}px))`,
            // Durante o gesto a foto tem que colar no dedo, sem amortecer.
            transition: arrasto !== 0 ? "none" : undefined,
          }}
        >
          {images.map((url, i) => (
            <div key={`${url}-${i}`} className="relative h-full w-full shrink-0">
              <Image
                src={url}
                alt={images.length > 1 ? `${alt} ${i + 1}` : alt}
                fill
                sizes={sizes}
                priority={priority && i === 0}
                draggable={false}
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
