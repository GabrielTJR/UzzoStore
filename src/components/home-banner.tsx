"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Chevron } from "@/components/carousel-arrows";
import type { BannerSlide } from "@/lib/home-sections";

/**
 * Seta do banner. Fica DISCRETA em repouso (véu leve) para não competir com a
 * arte, que é peça fechada com texto desenhado dentro, e só escurece no hover.
 * Não usa a pílula do carousel-arrows de propósito: aquela é opaca e segue o
 * token de tema — aqui a seta precisa se dissolver na foto.
 *
 * O chevron leva drop-shadow porque em repouso o véu é fraco demais para separar
 * o branco de uma arte clara (o slide "Bye Bye Inverno" é quase todo bege).
 */
const bannerArrow =
  "absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/15 text-white backdrop-blur-[2px] transition duration-200 ease-out hover:border-white/60 hover:bg-black/60 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 [&>svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]";

const ALIGN: Record<BannerSlide["align"], string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
};

/**
 * Banner do topo da home. Com mais de um slide vira carrossel (avança sozinho a
 * cada 6s, com setas e bolinhas). A imagem de mobile é opcional: sem ela, usa a
 * de desktop — por isso as duas são renderizadas e alternadas por CSS
 * (art direction; next/image não faz isso sozinho).
 *
 * No desktop o banner é LIMITADO a max-w-6xl (mesma largura do resto da home).
 * Ocupando a tela toda, o 16/9 dava 1080px de altura e engolia a primeira dobra.
 * Limitar a LARGURA e manter a proporção encolhe a altura junto SEM cortar nada:
 * as imagens são exatamente 1600x900 (16/9) no desktop e 1122x1402 (4/5) no
 * mobile, então mexer na proporção comeria a arte — é peça fechada, com texto e
 * ícones dentro. No celular segue de ponta a ponta, que é o certo em tela estreita.
 */
export function HomeBanner({ slides }: { slides: BannerSlide[] }) {
  const [i, setI] = useState(0);
  const many = slides.length > 1;

  useEffect(() => {
    if (!many) return;
    const t = window.setInterval(
      () => setI((p) => (p + 1) % slides.length),
      6000,
    );
    return () => window.clearInterval(t);
  }, [many, slides.length]);

  if (slides.length === 0) return null;
  const s = slides[Math.min(i, slides.length - 1)];
  const dark = s.theme === "dark";

  return (
    <section className="relative mx-auto mt-6 w-full max-w-6xl sm:mt-8 sm:px-6">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 sm:aspect-[16/9] sm:rounded-lg">
        {/* Todos os slides ficam montados e trocam por opacidade: remontar a
            <Image> a cada avanço deixava o banner branco enquanto carregava. */}
        {slides.map((sl, k) => {
          const desktop = sl.imageDesktop ?? sl.imageMobile;
          const mobile = sl.imageMobile ?? sl.imageDesktop;
          return (
            <div
              key={k}
              aria-hidden={k !== i}
              className={`absolute inset-0 transition-opacity duration-500 ${
                k === i ? "opacity-100" : "opacity-0"
              }`}
            >
              {mobile && (
                <Image
                  src={mobile}
                  alt={sl.title ?? "Uzzo Store"}
                  fill
                  sizes="(min-width: 1152px) 1152px, 100vw"
                  priority={k === 0}
                  className="object-cover sm:hidden"
                />
              )}
              {desktop && (
                <Image
                  src={desktop}
                  alt={sl.title ?? "Uzzo Store"}
                  fill
                  sizes="(min-width: 1152px) 1152px, 100vw"
                  priority={k === 0}
                  className="hidden object-cover sm:block"
                />
              )}
            </div>
          );
        })}

        {/* Véu para o texto ficar legível sobre qualquer foto */}
        {(s.title || s.subtitle || s.buttonLabel) && (
          <div
            aria-hidden
            className={`absolute inset-0 ${
              dark
                ? "bg-gradient-to-t from-white/70 via-white/25 to-transparent"
                : "bg-gradient-to-t from-black/60 via-black/20 to-transparent"
            }`}
          />
        )}

        <div
          className={`absolute inset-0 mx-auto flex max-w-6xl flex-col justify-end gap-4 px-6 pb-10 sm:justify-center sm:pb-0 ${
            ALIGN[s.align]
          } ${dark ? "text-zinc-900" : "text-white"}`}
        >
          {s.subtitle && (
            <p className="text-xs font-medium uppercase tracking-[0.3em] opacity-90">
              {s.subtitle}
            </p>
          )}
          {s.title && (
            <h2 className="max-w-2xl font-serif text-3xl font-semibold leading-tight tracking-tight drop-shadow-sm sm:text-5xl">
              {s.title}
            </h2>
          )}
          {s.buttonLabel && s.buttonHref && (
            <Link
              href={s.buttonHref}
              className={`inline-flex h-12 w-fit items-center justify-center rounded-full px-8 text-sm font-medium transition-opacity hover:opacity-90 ${
                dark ? "bg-zinc-900 text-white" : "bg-white text-zinc-900"
              }`}
            >
              {s.buttonLabel}
            </Link>
          )}
        </div>

        {many && (
          <>
            <button
              type="button"
              aria-label="Banner anterior"
              onClick={() =>
                setI((p) => (p - 1 + slides.length) % slides.length)
              }
              className={`${bannerArrow} left-4`}
            >
              <Chevron dir="left" px={20} />
            </button>
            <button
              type="button"
              aria-label="Próximo banner"
              onClick={() => setI((p) => (p + 1) % slides.length)}
              className={`${bannerArrow} right-4`}
            >
              <Chevron dir="right" px={20} />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
              {slides.map((_, k) => (
                <button
                  key={k}
                  type="button"
                  aria-label={`Ir para o banner ${k + 1}`}
                  aria-current={k === i ? "true" : undefined}
                  onClick={() => setI(k)}
                  className={`h-2 rounded-full transition ${
                    k === i ? "w-5 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
