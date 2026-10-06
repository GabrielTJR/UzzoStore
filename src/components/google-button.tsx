"use client";

import { useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * "Continuar com Google" (Supabase Auth, provedor Google).
 *
 * Ligado por `NEXT_PUBLIC_GOOGLE_LOGIN=1`, que só deve ir para a Vercel depois
 * de o provedor estar configurado no Supabase — antes disso o clique daria
 * "provider is not enabled".
 *
 * ⚠️ O Google BLOQUEIA login dentro de navegador embutido de app (erro
 * `disallowed_useragent`): Instagram, Facebook, TikTok… — de onde vem quase
 * todo cliente da loja. Nesses o botão não aparece; no lugar, uma dica para
 * abrir o site no navegador. O código por e-mail continua sendo o caminho
 * que funciona em qualquer lugar.
 *
 * A volta é pelo `/auth/callback` (troca do code pelo cookie de sessão, com o
 * `next` saneado lá). O fluxo PKCE guarda o verificador NESTE navegador, e a
 * sacola (localStorage) também está nele — por isso funciona no checkout.
 */
const LIGADO = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1";

const APP_EMBUTIDO =
  /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Messenger|Line\/|MicroMessenger|TikTok|musical_ly|BytedanceWebview|Snapchat|Pinterest|; wv\)/i;

const nada = () => () => {};

export function GoogleButton({
  next,
  separador = "ou",
}: {
  /** Para onde voltar depois de entrar (caminho interno). */
  next: string;
  /** Texto da linha divisória abaixo do botão (null = sem divisória). */
  separador?: string | null;
}) {
  // null no servidor e na hidratação; o user agent só existe no navegador.
  const embutido = useSyncExternalStore(
    nada,
    () => APP_EMBUTIDO.test(navigator.userAgent),
    () => null,
  );
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!LIGADO || embutido === null) return null;

  const divisoria = separador && (
    <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      {separador}
      <span className="h-px flex-1 bg-border" />
    </div>
  );

  if (embutido)
    return (
      <div className="space-y-4">
        <p className="rounded-xs bg-surface px-4 py-3 text-sm text-muted">
          Quer entrar com o Google? Abra o site no navegador do celular (no menu{" "}
          <span aria-hidden>⋯</span> do app, “Abrir no navegador”). Aqui dentro
          do app, entre com um código por e-mail.
        </p>
      </div>
    );

  async function entrar() {
    setIndo(true);
    setErro(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: "select_account" },
      },
    });
    // Sucesso = o navegador já está saindo para o Google.
    if (error) {
      setIndo(false);
      setErro(
        "Não conseguimos abrir o login do Google. Use o código por e-mail.",
      );
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={entrar}
        disabled={indo}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xs border border-border bg-background text-[0.95rem] font-semibold transition-colors hover:border-foreground disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z"
          />
          <path
            fill="#EA4335"
            d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9z"
          />
        </svg>
        {indo ? "Abrindo o Google…" : "Continuar com Google"}
      </button>
      {erro && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
      {divisoria}
    </div>
  );
}
