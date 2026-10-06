"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile — a checagem "não sou robô" do envio de código de
 * acesso. Gratuita e quase sempre invisível (`interaction-only`: só aparece
 * uma caixinha quando a Cloudflare desconfia).
 *
 * Por que existe: o envio de código tem um teto GLOBAL por hora (cada código é
 * um e-mail na cota que também manda os avisos de pedido). Sem isto, um script
 * esgotava o teto e nenhum cliente novo conseguia entrar por uma hora.
 *
 * Desligado quando `NEXT_PUBLIC_TURNSTILE_SITE_KEY` está vazia: o hook devolve
 * token nulo na hora e o servidor (sem `TURNSTILE_SECRET_KEY`) não confere.
 *
 * O token vale UMA vez: depois de cada envio, `reset()` pede outro (é o que
 * deixa o "Reenviar código" funcionar).
 */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function useTurnstile() {
  const boxRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const token = useRef<string | null>(null);
  const espera = useRef<((t: string | null) => void)[]>([]);
  const [carregado, setCarregado] = useState(false);
  /** A Cloudflare mostrou a caixinha "Confirme que é humano" e espera o
   * clique. Ref (lida no toque) — não precisa redesenhar nada. */
  const pedeClique = useRef(false);

  const entrega = useCallback((t: string | null) => {
    token.current = t;
    if (t) {
      pedeClique.current = false;
      for (const f of espera.current) f(t);
      espera.current = [];
    }
  }, []);

  useEffect(() => {
    if (!SITE_KEY || !carregado || !boxRef.current || !window.turnstile) return;
    if (widgetId.current) return;
    widgetId.current = window.turnstile.render(boxRef.current, {
      sitekey: SITE_KEY,
      action: "login-code",
      appearance: "interaction-only",
      language: "pt-br",
      size: "flexible",
      callback: (t: string) => entrega(t),
      "before-interactive-callback": () => {
        pedeClique.current = true;
      },
      "after-interactive-callback": () => {
        pedeClique.current = false;
      },
      "expired-callback": () => entrega(null),
      "error-callback": () => entrega(null),
    });
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [carregado, entrega]);

  /** Espera o token (até 10 s). Desligado → null na hora. */
  const getToken = useCallback((): Promise<string | null> => {
    if (!SITE_KEY) return Promise.resolve(null);
    if (token.current) return Promise.resolve(token.current);
    return new Promise((resolve) => {
      espera.current.push(resolve);
      setTimeout(() => resolve(token.current), 10_000);
    });
  }, []);

  /** A caixinha está pedindo o clique e ainda não há token: enviar agora só
   * daria erro depois de 10 s. Quem chama avisa o cliente para marcar. */
  const precisaMarcar = useCallback(
    () => !!SITE_KEY && pedeClique.current && !token.current,
    [],
  );

  /** Token gasto: pede outro para o próximo envio. */
  const reset = useCallback(() => {
    token.current = null;
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }, []);

  const widget = SITE_KEY ? (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setCarregado(true)}
      />
      {/* Fica fora dos dois passos (e-mail e código) para não desmontar
          quando a tela troca: a caixinha, se aparecer, continua aqui. */}
      <div ref={boxRef} className="mt-3 empty:hidden" />
    </>
  ) : null;

  return { widget, getToken, reset, precisaMarcar };
}
