"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { BannerSlide } from "@/lib/home-sections";

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
    <section className="relative">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 sm:aspect-[21/9]">
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
                  sizes="100vw"
                  priority={k === 0}
                  className="object-cover sm:hidden"
                />
              )}
              {desktop && (
                <Image
                  src={desktop}
                  alt={sl.title ?? "Uzzo Store"}
                  fill
                  sizes="100vw"
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
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/30 text-white backdrop-blur transition hover:bg-black/50 active:scale-90"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Próximo banner"
              onClick={() => setI((p) => (p + 1) % slides.length)}
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/30 text-white backdrop-blur transition hover:bg-black/50 active:scale-90"
            >
              ›
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
              {slides.map((_, k) => (
                <button
                  key={k}
                  type="button"
                  aria-label={`Ir para o banner ${k + 1}`}
                  aria-current={k === i ? "true" : undefined}
                  onClick={() => setI(k)}
                  className={`h-2 w-2 rounded-full transition ${
                    k === i ? "w-5 bg-white" : "bg-white/50 hover:bg-white/80"
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
