"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EmailCodeForm } from "@/components/email-code-form";
import { GoogleButton } from "@/components/google-button";
import { useTurnstile } from "@/components/turnstile";
import { emailAlreadyRegistered } from "./actions";

// Mesmos campos do checkout (`email-code-form.tsx`): 48px de altura para o
// dedo e `text-base` no celular — com 14px o iPhone dá zoom ao focar o campo
// e a tela "pula".
const field =
  "h-12 w-full rounded-xs border border-border bg-transparent px-4 text-base outline-none transition-colors focus:border-foreground aria-[invalid=true]:border-red-600 sm:text-sm";
const label = "block text-sm font-medium";
const primary =
  "inline-flex h-12 w-full items-center justify-center rounded-xs bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50";
const secondary =
  "inline-flex h-12 w-full items-center justify-center rounded-xs border border-border px-6 text-sm font-medium transition-colors hover:border-foreground";
const linkMuted =
  "inline-flex min-h-11 items-center text-sm text-muted underline-offset-4 hover:text-foreground hover:underline";
const errorCls = "text-sm text-red-600 dark:text-red-400";

/**
 * Caminho interno seguro para voltar depois do login (evita open-redirect).
 *
 * Checar o prefixo não basta: `/\evil.com` começa com "/" e não com "//", mas
 * o parser de URL resolve para `https://evil.com/`. Por isso normalizamos de
 * verdade contra a origem atual e só aceitamos o que continua nela.
 *
 * Sem `?next=`, o destino é a HOME. Era `/conta`, que largava o cliente na tela
 * de dados cadastrais — ele entrou para comprar, não para conferir o próprio
 * CPF. O `next` continua mandando quando existe: quem clicou no coração ou foi
 * barrado no checkout volta exatamente para onde estava.
 */
const DESTINO_PADRAO = "/";

function safeNext(v: string | null): string {
  if (!v) return DESTINO_PADRAO;
  try {
    // Base fictícia: este componente também renderiza no servidor, onde
    // `window` não existe. Se o valor escapar dessa base, é externo.
    const base = "http://interno.invalid";
    const url = new URL(v, base);
    if (url.origin !== base) return DESTINO_PADRAO;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DESTINO_PADRAO;
  }
}

/** Senha com "Mostrar": no celular, errar uma letra às cegas é o motivo nº 1
 * de "senha incorreta" de quem sabe a senha. */
function PasswordInput({
  id,
  autoComplete,
  invalid,
  describedBy,
}: {
  id: string;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  describedBy?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name="password"
        type={show ? "text" : "password"}
        required
        minLength={autoComplete === "new-password" ? 8 : undefined}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`${field} pr-20`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 px-4 text-sm text-muted hover:text-foreground"
      >
        {show ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Senha errada (e não outra falha): é quando vale oferecer o código. */
  const [senhaErrada, setSenhaErrada] = useState(false);
  // Anti-robô (Turnstile): o token vai junto ao Supabase, que o confere
  // quando o CAPTCHA estiver ligado no painel dele (Attack Protection).
  const turnstile = useTurnstile();
  // Quem comprou pelo checkout ganhou conta por CÓDIGO, sem senha nenhuma.
  // Se essa pessoa abre /entrar e só encontra "Senha", fica trancada do lado
  // de fora de uma conta que é dela. O modo "codigo" é a porta para ela — e
  // também para quem esqueceu a senha e não quer esperar o link de troca.
  // Por isso os dois modos ficam lado a lado, com o mesmo peso, no topo.
  // `?modo=codigo` abre direto no código (link de "Esqueci a senha").
  const [modo, setModo] = useState<"senha" | "codigo">(() =>
    params.get("modo") === "codigo" ? "codigo" : "senha",
  );

  function trocarModo(m: "senha" | "codigo") {
    setError(null);
    setSenhaErrada(false);
    setModo(m);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSenhaErrada(false);
    if (turnstile.precisaMarcar()) {
      setError("Marque “Confirme que é humano”, logo abaixo, e tente de novo.");
      return;
    }
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const captchaToken = (await turnstile.getToken()) ?? undefined;
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      options: { captchaToken },
    });
    turnstile.reset();
    if (error) {
      setError("E-mail ou senha incorretos.");
      setSenhaErrada(true);
      setBusy(false);
      return;
    }
    // Navegação com recarga completa: uma transição de client pode renderizar a
    // página antes do servidor enxergar o cookie de sessão recém-criado.
    window.location.assign(next);
  }

  const abas = (
    <div
      role="group"
      aria-label="Como entrar"
      className="grid grid-cols-2 gap-1 rounded-xs bg-surface p-1"
    >
      {(
        [
          ["senha", "Com senha"],
          ["codigo", "Com código"],
        ] as const
      ).map(([m, rotulo]) => (
        <button
          key={m}
          type="button"
          onClick={() => trocarModo(m)}
          aria-pressed={modo === m}
          className={`h-10 rounded-xs text-sm transition-colors ${
            modo === m
              ? "bg-background font-semibold text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );

  const rodape = (
    <p className="border-t border-border pt-5 text-sm text-muted">
      Primeira vez aqui?{" "}
      <Link
        href={`/cadastro?next=${encodeURIComponent(next)}`}
        className="font-medium text-foreground underline underline-offset-4"
      >
        Criar conta
      </Link>
    </p>
  );

  if (modo === "codigo") {
    return (
      <div className="space-y-6">
        <GoogleButton next={next} />
        {abas}
        {/* Mesmo componente do checkout: rascunho no localStorage, foco no
            campo do código dentro do toque (iOS) e detector de laço já vêm
            prontos. `senhaHref` fica nulo porque a volta para a senha é a
            aba acima, que troca o modo sem recarregar a página. O destino
            é o mesmo `next` saneado do login por senha, e com RECARGA
            COMPLETA pelo mesmo motivo (cookie de sessão recém-criado). */}
        <EmailCodeForm
          origem="entrar"
          senhaHref={null}
          onVerified={() => window.location.assign(next)}
        />
        {rodape}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GoogleButton next={next} />
      {abas}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Chega aqui vindo de um link de e-mail que não valeu mais (expirou,
            foi aberto em outro aparelho ou já tinha sido usado). Sem isto a
            pessoa cairia na tela de login sem entender por quê. */}
        {params.get("erro") === "google" && (
          <div className="rounded-xs bg-surface px-4 py-3 text-sm">
            Não deu para entrar com o Google (a janela foi fechada ou o acesso
            foi negado). Tente de novo ou entre com um código por e-mail.
          </div>
        )}
        {params.get("erro") === "link-invalido" && (
          <div className="rounded-xs bg-surface px-4 py-3 text-sm">
            Esse link expirou ou foi aberto em outro aparelho. Entre com sua
            senha, com um código ou{" "}
            <Link
              href="/esqueci-senha"
              className="underline underline-offset-4"
            >
              peça um novo link
            </Link>
            .
          </div>
        )}
        <div className="space-y-1.5">
          <label className={label} htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            className={field}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <label className={label} htmlFor="password">
              Senha
            </label>
            <Link
              href="/esqueci-senha"
              className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              Esqueci a senha
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            invalid={senhaErrada}
            describedBy={error ? "login-erro" : undefined}
          />
        </div>
        {error && (
          <p id="login-erro" role="alert" className={errorCls}>
            {error}
            {/* Quem errou a senha talvez nunca tenha tido uma (conta criada no
                checkout). A saída fica no próprio aviso, onde o olho já está. */}
            {senhaErrada && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => trocarModo("codigo")}
                  className="underline underline-offset-4"
                >
                  Comprou sem criar senha? Entre com um código por e-mail.
                </button>
              </>
            )}
          </p>
        )}
        {turnstile.widget}
        <button type="submit" disabled={busy} className={primary}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
      {rodape}
    </div>
  );
}

export function SignupForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [existing, setExisting] = useState(false);
  const turnstile = useTurnstile();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const email = String(form.get("email") ?? "").trim();
    if (password.length < 8) {
      setError("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    setBusy(true);

    // Checa ANTES: o Supabase responde "sucesso" para e-mail já cadastrado e
    // não envia nada — sem isso, a pessoa espera um e-mail que nunca chega.
    if (await emailAlreadyRegistered(email)) {
      setBusy(false);
      setExisting(true);
      return;
    }

    if (turnstile.precisaMarcar()) {
      setBusy(false);
      setError("Marque “Confirme que é humano”, logo abaixo, e tente de novo.");
      return;
    }
    const captchaToken = (await turnstile.getToken()) ?? undefined;
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        captchaToken,
        data: { full_name: String(form.get("fullName") ?? "").trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (error) {
      setError(
        error.message.toLowerCase().includes("already")
          ? "Já existe uma conta com esse e-mail."
          : "Não foi possível criar a conta.",
      );
      return;
    }
    // Com confirmação de e-mail ligada não vem sessão; com ela desligada, vem.
    if (data.session) window.location.assign(next);
    else setSent(true);
  }

  if (existing) {
    return (
      <div className="space-y-4 rounded-sm bg-surface p-5 text-sm">
        <div>
          <p className="font-semibold">Este e-mail já tem conta</p>
          <p className="mt-1 text-muted">
            Entre com sua senha ou, se não tiver uma, com um código por e-mail.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/entrar?next=${encodeURIComponent(next)}`}
            className={primary}
          >
            Entrar
          </Link>
          <Link href="/esqueci-senha" className={`${secondary} bg-background`}>
            Esqueci minha senha
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setExisting(false)}
          className={linkMuted}
        >
          Usar outro e-mail
        </button>
      </div>
    );
  }

  if (sent) {
    return (
      <div
        role="status"
        className="space-y-2 rounded-sm bg-surface p-5 text-sm"
      >
        <p className="font-semibold">Confira seu e-mail</p>
        <p className="text-muted">
          Enviamos um link para confirmar sua conta. Depois de confirmar, você
          já entra direto.
        </p>
        <p className="text-muted">Não achou? Veja também no lixo eletrônico.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GoogleButton next={next} separador="ou crie com e-mail e senha" />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className={label} htmlFor="fullName">
            Nome completo
          </label>
          <input
            id="fullName"
            name="fullName"
            required
            autoComplete="name"
            className={field}
          />
        </div>
        <div className="space-y-1.5">
          <label className={label} htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            className={field}
          />
        </div>
        <div className="space-y-1.5">
          <label className={label} htmlFor="password">
            Senha
          </label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            describedBy="senha-dica"
          />
          <p id="senha-dica" className="text-sm text-muted">
            Mínimo de 8 caracteres.
          </p>
        </div>
        {error && (
          <p role="alert" className={errorCls}>
            {error}
          </p>
        )}
        {turnstile.widget}
        <button type="submit" disabled={busy} className={primary}>
          {busy ? "Criando…" : "Criar conta"}
        </button>
        <p className="border-t border-border pt-5 text-sm text-muted">
          Já tem conta?{" "}
          <Link
            href={`/entrar?next=${encodeURIComponent(next)}`}
            className="font-medium text-foreground underline underline-offset-4"
          >
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}

export function ForgotPasswordForm() {
  const turnstile = useTurnstile();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (turnstile.precisaMarcar()) {
      setError("Marque “Confirme que é humano”, logo abaixo, e tente de novo.");
      return;
    }
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const captchaToken = (await turnstile.getToken()) ?? undefined;
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      String(form.get("email") ?? "").trim(),
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/nova-senha`,
        captchaToken,
      },
    );
    turnstile.reset();
    setBusy(false);
    if (error) {
      setError("Não foi possível enviar o e-mail.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div
        role="status"
        className="space-y-2 rounded-sm bg-surface p-5 text-sm"
      >
        <p className="font-semibold">Confira seu e-mail</p>
        <p className="text-muted">
          Se existir uma conta com esse e-mail, enviamos um link para criar uma
          nova senha. Abra o link neste mesmo aparelho.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className={label} htmlFor="email">
          E-mail da conta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          className={field}
        />
      </div>
      {error && (
        <p role="alert" className={errorCls}>
          {error}
        </p>
      )}
      {turnstile.widget}
      <button type="submit" disabled={busy} className={primary}>
        {busy ? "Enviando…" : "Enviar link"}
      </button>
    </form>
  );
}

export function NewPasswordForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 8) {
      setError("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError("O link expirou. Peça um novo e-mail.");
      return;
    }
    router.replace("/conta");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className={label} htmlFor="password">
          Nova senha
        </label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          invalid={!!error}
          describedBy="nova-senha-dica"
        />
        <p
          id="nova-senha-dica"
          className={error ? errorCls : "text-sm text-muted"}
        >
          {error ?? "Mínimo de 8 caracteres."}
        </p>
      </div>
      {error && error.startsWith("O link") && (
        <Link href="/esqueci-senha" className={secondary}>
          Pedir um novo link
        </Link>
      )}
      <button type="submit" disabled={busy} className={primary}>
        {busy ? "Salvando…" : "Salvar senha"}
      </button>
    </form>
  );
}
