"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EmailCodeForm } from "@/components/email-code-form";
import { emailAlreadyRegistered } from "./actions";

const field =
  "w-full rounded-xs border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-foreground";
const label = "block text-sm font-medium";
const primary =
  "inline-flex h-11 w-full items-center justify-center rounded-xs bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50";

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

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Senha errada (e não outra falha): é quando vale oferecer o código. */
  const [senhaErrada, setSenhaErrada] = useState(false);
  // Quem comprou pelo checkout ganhou conta por CÓDIGO, sem senha nenhuma.
  // Se essa pessoa abre /entrar e só encontra "Senha", fica trancada do lado
  // de fora de uma conta que é dela. O modo "codigo" é a porta para ela — e
  // também para quem esqueceu a senha e não quer esperar o link de troca.
  const [modo, setModo] = useState<"senha" | "codigo">("senha");

  function irParaCodigo() {
    setError(null);
    setSenhaErrada(false);
    setModo("codigo");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSenhaErrada(false);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
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

  if (modo === "codigo") {
    return (
      <div className="space-y-5">
        {/* Mesmo componente do checkout: rascunho no localStorage, foco no
            campo do código dentro do toque (iOS) e detector de laço já vêm
            prontos. `senhaHref` fica nulo porque a volta para a senha é o
            botão abaixo, que troca o modo sem recarregar a página. O destino
            é o mesmo `next` saneado do login por senha, e com RECARGA
            COMPLETA pelo mesmo motivo (cookie de sessão recém-criado). */}
        <EmailCodeForm
          origem="entrar"
          senhaHref={null}
          onVerified={() => window.location.assign(next)}
        />
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setModo("senha")}
            className="inline-flex min-h-11 items-center text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            Entrar com senha
          </button>
          <Link
            href={`/cadastro?next=${encodeURIComponent(next)}`}
            className="text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            Criar conta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Chega aqui vindo de um link de e-mail que não valeu mais (expirou,
          foi aberto em outro aparelho ou já tinha sido usado). Sem isto a
          pessoa cairia na tela de login sem entender por quê. */}
      {params.get("erro") === "link-invalido" && (
        <div className="rounded-xs border border-border bg-black/5 px-4 py-3 text-sm dark:bg-white/5">
          Esse link expirou ou foi aberto em outro aparelho. Entre com sua senha
          ou{" "}
          <Link href="/esqueci-senha" className="underline underline-offset-4">
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
          className={field}
        />
      </div>
      <div className="space-y-1.5">
        <label className={label} htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={field}
        />
      </div>
      {error && (
        <p className="text-sm text-red-600">
          {error}
          {/* Quem errou a senha talvez nunca tenha tido uma (conta criada no
              checkout). A saída fica no próprio aviso, onde o olho já está. */}
          {senhaErrada && (
            <>
              {" "}
              <button
                type="button"
                onClick={irParaCodigo}
                className="underline underline-offset-4"
              >
                Você também pode entrar com um código por e-mail.
              </button>
            </>
          )}
        </p>
      )}
      <button type="submit" disabled={busy} className={primary}>
        {busy ? "Entrando…" : "Entrar"}
      </button>
      {/* Botão (não link): troca o modo na mesma tela, sem navegar. */}
      <p className="text-sm text-muted">
        Não tem senha ou esqueceu?{" "}
        <button
          type="button"
          onClick={irParaCodigo}
          className="inline-flex min-h-11 items-center align-middle text-foreground underline underline-offset-4"
        >
          Entrar com código por e-mail
        </button>
      </p>
      <div className="flex items-center justify-between text-sm">
        <Link
          href="/esqueci-senha"
          className="text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          Esqueci minha senha
        </Link>
        <Link
          href={`/cadastro?next=${encodeURIComponent(next)}`}
          className="text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          Criar conta
        </Link>
      </div>
    </form>
  );
}

export function SignupForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [existing, setExisting] = useState(false);

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

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
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
      <div className="space-y-3 rounded-sm border border-border p-5 text-sm">
        <p className="font-medium">Este e-mail já tem conta</p>
        <p className="text-muted">
          Entre com sua senha ou, se não lembrar, crie uma nova.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            href={`/entrar?next=${encodeURIComponent(next)}`}
            className="inline-flex h-10 items-center justify-center rounded-xs bg-foreground px-6 text-sm font-medium text-background hover:opacity-90"
          >
            Entrar
          </Link>
          <Link
            href="/esqueci-senha"
            className="inline-flex h-10 items-center justify-center rounded-xs border border-border px-6 text-sm font-medium hover:border-foreground"
          >
            Esqueci minha senha
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setExisting(false)}
          className="text-sm text-muted underline underline-offset-4 hover:text-foreground"
        >
          Usar outro e-mail
        </button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="space-y-3 rounded-sm border border-border p-5 text-sm">
        <p className="font-medium">Confira seu e-mail 📬</p>
        <p className="text-muted">
          Enviamos um link para confirmar sua conta. Depois de confirmar, você
          já entra direto.
        </p>
        <p className="text-xs text-muted">
          Não achou? Veja também no lixo eletrônico.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
          className={field}
        />
      </div>
      <div className="space-y-1.5">
        <label className={label} htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={field}
        />
        <p className="text-xs text-muted">Mínimo de 8 caracteres.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className={primary}>
        {busy ? "Criando…" : "Criar conta"}
      </button>
      <p className="text-sm text-muted">
        Já tem conta?{" "}
        <Link
          href={`/entrar?next=${encodeURIComponent(next)}`}
          className="underline underline-offset-4 hover:text-foreground"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      String(form.get("email") ?? "").trim(),
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/nova-senha`,
      },
    );
    setBusy(false);
    if (error) {
      setError("Não foi possível enviar o e-mail.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p className="rounded-sm border border-border p-5 text-sm text-muted">
        Se existir uma conta com esse e-mail, enviamos um link para criar uma
        nova senha.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className={label} htmlFor="email">
          E-mail da conta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className={field}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className={label} htmlFor="password">
          Nova senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={field}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className={primary}>
        {busy ? "Salvando…" : "Salvar senha"}
      </button>
    </form>
  );
}
