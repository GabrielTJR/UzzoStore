"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { changePassword } from "../auth-actions";

const inputClass =
  "w-full rounded-md border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-foreground";

export default function DefinirSenhaPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/admin/login");
        return;
      }
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    setLoading(true);
    const res = await changePassword(password);
    if (!res.ok) {
      setError(res.error ?? "Não foi possível definir a senha.");
      setLoading(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        Definir nova senha
      </h1>
      <p className="mt-2 text-sm text-muted">
        Escolha uma nova senha para sua conta.
      </p>
      {!ready ? (
        <p className="mt-8 text-sm text-muted">Carregando…</p>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <input
            type="password"
            required
            autoFocus
            placeholder="Nova senha (mín. 8 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-full bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Salvando…" : "Salvar e continuar"}
          </button>
        </form>
      )}
    </section>
  );
}
