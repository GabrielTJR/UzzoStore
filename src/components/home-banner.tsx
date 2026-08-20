"use client";

import { useEffect, useRef, useState } from "react";
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
 *
 * `hidden sm:flex`: no celular quem passa o slide é o dedo, e botão de 44px em
 * tela estreita rouba área justamente de onde a arte tem menos folga.
 */
const bannerArrow =
  "absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/15 text-white backdrop-blur-[2px] transition duration-200 ease-out hover:border-white/60 hover:bg-black/60 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:flex [&>svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]";

const ALIGN: Record<BannerSlide["align"], string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
};

/** Arrasto que confirma a troca: 12% da largura, nunca menos que 40px. */
const limiar = (largura: number) => Math.max(40, largura * 0.12);

/**
 * Banner do topo da home. Com mais de um slide vira carrossel (avança sozinho a
 * cada 6s, com bolinhas). A imagem de mobile é opcional: sem ela, usa a de
 * desktop — por isso as duas são renderizadas e alternadas por CSS
 * (art direction; next/image não faz isso sozinho).
 *
 * O banner ocupa 80% da largura no desktop. A altura sai da PROPORÇÃO, nunca de
 * um corte: as imagens são exatamente 1600x900 (16/9) no desktop e 1122x1402
 * (4/5) no mobile, e mexer na proporção comeria a arte, que tem título, selo e
 * ícones desenhados dentro. No celular vai de ponta a ponta.
 *
 * Os slides vivem numa faixa que desliza por translateX (não é mais troca por
 * opacidade): é o que permite a imagem ACOMPANHAR o dedo durante o arrasto, em
 * vez de piscar para a próxima. Todos ficam montados — remontar a <Image> a cada
 * avanço deixava o banner branco enquanto carregava.
 *
 * No celular não há setas: quem passa é o arrasto. A passagem automática vale
 * nos dois.
 */
export function HomeBanner({ slides }: { slides: BannerSlide[] }) {
  const [i, setI] = useState(0);
  const [arrasto, setArrasto] = useState(0); // px do gesto em andamento
  const [reinicio, setReinicio] = useState(0);
  const gesto = useRef<{
    x: number;
    y: number;
    largura: number;
    horizontal: boolean;
  } | null>(null);
  const many = slides.length > 1;

  // setTimeout reagendado a cada `i`, não setInterval: assim QUALQUER troca
  // manual (seta, bolinha, arrasto) zera a contagem. Com intervalo fixo, passar
  // o slide a 5,9s do ciclo emendava o automático 0,1s depois e pulava dois.
  // O `reinicio` cobre o encostar do dedo: o gesto começou, o relógio recomeça,
  // e a imagem não foge da mão no meio do arrasto.
  useEffect(() => {
    if (!many) return;
    const t = window.setTimeout(
      () => setI((p) => (p + 1) % slides.length),
      6000,
    );
    return () => window.clearTimeout(t);
  }, [i, reinicio, many, slides.length]);

  if (slides.length === 0) return null;

  const vai = (passo: number) =>
    setI((p) => (p + passo + slides.length) % slides.length);

  // Só toque: no mouse o arrasto atrapalharia o clique no botão do banner.
  function aoPressionar(e: React.PointerEvent) {
    if (!many || e.pointerType !== "touch") return;
    setReinicio((r) => r + 1);
    gesto.current = {
      x: e.clientX,
      y: e.clientY,
      largura: e.currentTarget.clientWidth,
      horizontal: false,
    };
  }

  function aoMover(e: React.PointerEvent) {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    // Enquanto o gesto não se declarar horizontal, não sequestra a rolagem da
    // página: quem tentava descer a home ficaria preso no banner.
    if (!g.horizontal) {
      if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return;
      g.horizontal = true;
    }
    // Nas pontas o arrasto fica pesado (o clássico elástico). Sem isso, puxar
    // para trás no primeiro slide descobre o fundo cinza da caixa.
    const naPonta = (dx > 0 && i === 0) || (dx < 0 && i === slides.length - 1);
    setArrasto(naPonta ? dx * 0.35 : dx);
  }

  function aoSoltar() {
    const g = gesto.current;
    gesto.current = null;
    if (g?.horizontal && Math.abs(arrasto) > limiar(g.largura)) {
      vai(arrasto < 0 ? 1 : -1);
    }
    setArrasto(0);
  }

  return (
    <section className="relative mx-auto mt-6 w-full sm:mt-8 sm:w-[80%]">
      <div
        className="relative aspect-[4/5] w-full touch-pan-y overflow-hidden bg-zinc-200 dark:bg-zinc-800 sm:aspect-[16/9] sm:rounded-lg"
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
      >
        <div
          className="flex h-full w-full transition-transform duration-300 ease-out"
          style={{
            transform: `translateX(calc(${-i * 100}% + ${arrasto}px))`,
            // Durante o gesto a imagem tem que colar no dedo, sem amortecer.
            transition: arrasto !== 0 ? "none" : undefined,
          }}
        >
          {slides.map((sl, k) => {
            const desktop = sl.imageDesktop ?? sl.imageMobile;
            const mobile = sl.imageMobile ?? sl.imageDesktop;
            const claro = sl.theme === "dark"; // arte clara => texto escuro
            return (
              <div
                key={k}
                aria-hidden={k !== i}
                className="relative h-full w-full shrink-0"
              >
                {mobile && (
                  <Image
                    src={mobile}
                    alt={sl.title ?? "Uzzo Store"}
                    fill
                    sizes="(min-width: 640px) 80vw, 100vw"
                    priority={k === 0}
                    draggable={false}
                    className="object-cover sm:hidden"
                  />
                )}
                {desktop && (
                  <Image
                    src={desktop}
                    alt={sl.title ?? "Uzzo Store"}
                    fill
                    sizes="(min-width: 640px) 80vw, 100vw"
                    priority={k === 0}
                    draggable={false}
                    className="hidden object-cover sm:block"
                  />
                )}

                {/* Véu para o texto ficar legível sobre qualquer foto */}
                {(sl.title || sl.subtitle || sl.buttonLabel) && (
                  <div
                    aria-hidden
                    className={`absolute inset-0 ${
                      claro
                        ? "bg-gradient-to-t from-white/70 via-white/25 to-transparent"
                        : "bg-gradient-to-t from-black/60 via-black/20 to-transparent"
                    }`}
                  />
                )}

                <div
                  className={`absolute inset-0 mx-auto flex w-full flex-col justify-end gap-4 px-6 pb-10 sm:justify-center sm:pb-0 ${
                    ALIGN[sl.align]
                  } ${claro ? "text-zinc-900" : "text-white"}`}
                >
                  {sl.subtitle && (
                    <p className="text-xs font-medium uppercase tracking-[0.3em] opacity-90">
                      {sl.subtitle}
                    </p>
                  )}
                  {sl.title && (
                    <h2 className="max-w-2xl font-serif text-3xl font-semibold leading-tight tracking-tight drop-shadow-sm sm:text-5xl">
                      {sl.title}
                    </h2>
                  )}
                  {sl.buttonLabel && sl.buttonHref && (
                    <Link
                      href={sl.buttonHref}
                      className={`inline-flex h-12 w-fit items-center justify-center rounded-full px-8 text-sm font-medium transition-opacity hover:opacity-90 ${
                        claro
                          ? "bg-zinc-900 text-white"
                          : "bg-white text-zinc-900"
                      }`}
                    >
                      {sl.buttonLabel}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {many && (
          <>
            <button
              type="button"
              aria-label="Banner anterior"
              onClick={() => vai(-1)}
              className={`${bannerArrow} left-4`}
            >
              <Chevron dir="left" px={20} />
            </button>
            <button
              type="button"
              aria-label="Próximo banner"
              onClick={() => vai(1)}
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
