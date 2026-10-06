"use client";

import { useEffect } from "react";

/**
 * No Safari do iPhone, `:active` só pinta enquanto o dedo está na tela se a
 * página tiver ALGUM ouvinte de toque. Este é esse ouvinte — vazio e passivo
 * (não atrapalha a rolagem). É o que faz o "afundar" do botão (globals.css)
 * aparecer no iOS como aparece no Android e no mouse.
 */
export function TouchActive() {
  useEffect(() => {
    const nada = () => {};
    document.addEventListener("touchstart", nada, { passive: true });
    return () => document.removeEventListener("touchstart", nada);
  }, []);
  return null;
}
