"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const field =
  "w-full rounded-md border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-foreground";
const label = "block text-sm font-medium";
const primary =
  "inline-flex h-11 w-full items-center justify-center rounded-full bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50";

/** Caminho interno seguro para voltar depois do login (evita open-redirect). */
function safeNext(v: string | null): string {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/conta";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
    if (error) {
      setError("E-mail ou senha incorretos.");
      setBusy(false);
      return;
    }
    // Navegação com recarga completa: uma transição de client pode renderizar a
    // página antes do servidor enxergar o cookie de sessão recém-criado.
    window.location.assign(next);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className={label} htmlFor="email">
          E-mail
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className={field} />
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className={primary}>
        {busy ? "Entrando…" : "Entrar"}
      </button>
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
    const { data, error } = await supabase.auth.signUp({
      email: String(form.get("email") ?? "").trim(),
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

  if (sent) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-5 text-sm">
        <p className="font-medium">Confira seu e-mail 📬</p>
        <p className="text-muted">
          Se este e-mail ainda não tiver conta, enviamos um link para confirmar
          — é só clicar nele para entrar.
        </p>
        {/* O Supabase responde "sucesso" mesmo quando o e-mail já tem conta
            (assim ninguém descobre quais e-mails são cadastrados) e nesse caso
            não envia nada. Sem este aviso, quem já tem conta fica esperando um
            e-mail que nunca chega. */}
        <p className="text-muted">
          Já tem conta com esse e-mail? Nenhum e-mail é enviado — use{" "}
          <Link
            href="/entrar"
            className="underline underline-offset-4 hover:text-foreground"
          >
            entrar
          </Link>{" "}
          ou{" "}
          <Link
            href="/esqueci-senha"
            className="underline underline-offset-4 hover:text-foreground"
          >
            recuperar a senha
          </Link>
          .
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
        <input id="fullName" name="fullName" required autoComplete="name" className={field} />
      </div>
      <div className="space-y-1.5">
        <label className={label} htmlFor="email">
          E-mail
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className={field} />
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
      { redirectTo: `${window.location.origin}/auth/callback?next=/nova-senha` },
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
      <p className="rounded-lg border border-border p-5 text-sm text-muted">
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
        <input id="email" name="email" type="email" required className={field} />
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
