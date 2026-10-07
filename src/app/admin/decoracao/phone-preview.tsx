"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Tamanho da "tela" de cada prévia. Celular: um aparelho comum (iPhone
 * mini/SE, 375 px). Computador: uma tela de notebook (1280 × 760), mostrada
 * REDUZIDA para caber na coluna — o layout é o de 1280 de verdade, só a
 * imagem encolhe.
 */
const TELAS = {
  cel: { largura: 375, altura: 660, escala: 1 },
  pc: { largura: 1280, altura: 760, escala: 375 / 1280 },
} as const;

/**
 * Moldura que renderiza os componentes REAIS da loja, como celular ou como
 * computador.
 *
 * Por que um iframe: os componentes da loja decidem o layout por media query
 * (`lg:`, `sm:`), que olha a largura da JANELA — no painel, a 1440 px, o hero
 * sairia no desenho de desktop mesmo dentro de uma caixa estreita. Dentro de
 * um iframe de 375 px, a "janela" é o iframe, e o Tailwind escolhe o desenho
 * de celular sozinho, sem uma linha de CSS paralelo (e no de 1280, o de
 * computador).
 *
 * Os componentes não são carregados por URL: o React renderiza DENTRO do
 * documento do iframe por portal (mesma árvore, mesmo estado), então a prévia
 * muda a cada tecla do editor sem salvar nada e sem ida ao servidor. Os
 * estilos da página (Tailwind, fontes) são copiados para o iframe na montagem.
 *
 * É só para ver: cliques são engolidos (um link levaria o iframe para a loja).
 */
export function PhonePreview({
  children,
  formato = "cel",
}: {
  children: React.ReactNode;
  formato?: "cel" | "pc";
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);
  const tela = TELAS[formato];

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;

    function monta() {
      const doc = iframe?.contentDocument;
      if (!doc) return;
      // Estilos da página: <link rel=stylesheet> e <style> (no dev, o
      // Turbopack injeta como <style>; no build, como <link>).
      doc.head.querySelectorAll("[data-copia]").forEach((n) => n.remove());
      document
        .querySelectorAll('link[rel="stylesheet"], style')
        .forEach((n) => {
          const c = n.cloneNode(true) as HTMLElement;
          c.setAttribute("data-copia", "");
          doc.head.appendChild(c);
        });
      // Fonte (variável do next/font), tema e idioma vivem no <html>.
      const html = document.documentElement;
      doc.documentElement.className = html.className;
      doc.documentElement.lang = html.lang;
      for (const a of ["data-theme", "style"]) {
        const v = html.getAttribute(a);
        if (v != null) doc.documentElement.setAttribute(a, v);
      }
      doc.body.className = "flex min-h-full flex-col";
      doc.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
        true,
      );
      setAlvo(doc.body);
    }

    // O documento do srcDoc pode ficar pronto ANTES deste efeito (aí o "load"
    // já passou e nunca mais vem): nesse caso monta na próxima volta.
    iframe.addEventListener("load", monta);
    const t = window.setTimeout(() => {
      if (iframe.contentDocument?.readyState === "complete") monta();
    }, 0);
    return () => {
      iframe.removeEventListener("load", monta);
      window.clearTimeout(t);
    };
  }, []);

  const iframe = (
    <iframe
      ref={ref}
      title={`Prévia da página inicial no ${formato === "cel" ? "celular" : "computador"}`}
      srcDoc='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>'
      className="block bg-background"
      style={{
        width: tela.largura,
        height: tela.altura,
        transform: tela.escala !== 1 ? `scale(${tela.escala})` : undefined,
        transformOrigin: "top left",
      }}
    />
  );

  return formato === "cel" ? (
    <div
      className="mx-auto overflow-hidden rounded-[2.4rem] border-[10px] border-black bg-black shadow-sm"
      style={{ width: tela.largura + 20 }}
    >
      <div className="overflow-hidden rounded-[1.7rem]">{iframe}</div>
      {alvo && createPortal(children, alvo)}
    </div>
  ) : (
    <div
      className="mx-auto overflow-hidden rounded-md border-[10px] border-black bg-black shadow-sm"
      style={{ width: tela.largura * tela.escala + 20 }}
    >
      <div
        className="overflow-hidden"
        style={{
          width: tela.largura * tela.escala,
          height: tela.altura * tela.escala,
        }}
      >
        {iframe}
      </div>
      {alvo && createPortal(children, alvo)}
    </div>
  );
}
