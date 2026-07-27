"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkAdminEmail, changePassword, recordLogin } from "../auth-actions";

type Mode = "email" | "password" | "firstAccess" | "resetSent";

const inputClass =
  "w-full rounded-md border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-foreground";
const buttonClass =
  "h-11 w-full rounded-full bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50";

export default function AdminLoginPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { mustChange } = await checkAdminEmail(email);
      setMode(mustChange ? "firstAccess" : "password");
    } finally {
      setLoading(false);
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr) {
      setError("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }
    await recordLogin();
    router.replace("/admin");
    router.refresh();
  }

  async function submitFirstAccess(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("A nova senha deve ter ao menos 8 caracteres.");
      return;
    }
    setLoading(true);
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password: tempPassword,
    });
    if (signErr) {
      setError("Senha provisória incorreta.");
      setLoading(false);
      return;
    }
    const res = await changePassword(newPassword);
    if (!res.ok) {
      setError(res.error ?? "Não foi possível definir a nova senha.");
      setLoading(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  async function forgotPassword() {
    if (!email) {
      setError("Digite seu e-mail primeiro.");
      return;
    }
    setLoading(true);
    setError(null);
    const origin = window.location.origin;
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/admin/definir-senha`,
    });
    setMode("resetSent");
    setLoading(false);
  }

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        Área administrativa
      </h1>

      {mode === "email" && (
        <form onSubmit={submitEmail} className="mt-8 space-y-4">
          <p className="text-sm text-muted">Acesso restrito à equipe Uzzo Store.</p>
          <input
            type="email"
            required
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Verificando…" : "Continuar"}
          </button>
        </form>
      )}

      {mode === "password" && (
        <form onSubmit={submitPassword} className="mt-8 space-y-4">
          <p className="text-sm text-muted">{email}</p>
          <input
            type="password"
            required
            autoFocus
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setMode("email");
                setError(null);
              }}
              className="text-muted hover:text-foreground"
            >
              ← Trocar e-mail
            </button>
            <button
              type="button"
              onClick={forgotPassword}
              disabled={loading}
              className="text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              Esqueci minha senha
            </button>
          </div>
        </form>
      )}

      {mode === "firstAccess" && (
        <form onSubmit={submitFirstAccess} className="mt-8 space-y-4">
          <div className="rounded-md border border-border bg-foreground/[.03] px-4 py-3 text-sm">
            <p className="font-medium">Primeiro acesso</p>
            <p className="mt-1 text-muted">
              Digite a senha provisória e defina uma nova senha para{" "}
              <span className="text-foreground">{email}</span>.
            </p>
          </div>
          <input
            type="password"
            required
            autoFocus
            placeholder="Senha provisória"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            className={inputClass}
          />
          <input
            type="password"
            required
            placeholder="Nova senha (mín. 8 caracteres)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Definindo…" : "Definir senha e entrar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("email");
              setError(null);
            }}
            className="text-sm text-muted hover:text-foreground"
          >
            ← Trocar e-mail
          </button>
        </form>
      )}

      {mode === "resetSent" && (
        <div className="mt-8 space-y-4">
          <p className="text-sm">
            Se <span className="font-medium">{email}</span> for um admin
            cadastrado, enviamos um link para redefinir a senha. Confira seu
            e-mail.
          </p>
          <button
            type="button"
            onClick={() => setMode("email")}
            className="text-sm text-muted hover:text-foreground"
          >
            ← Voltar
          </button>
        </div>
      )}
    </section>
  );
}
