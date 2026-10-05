"use client";

import { useState } from "react";
import { subscribeNewsletterAction } from "@/app/newsletter-actions";

/** Captura de e-mail — o único canal de remarketing que a loja é dona
 * (Instagram é terreno alugado). `inverse` é a versão para fundo preto
 * (rodapé); a padrão vai sobre o fundo da página ("Feminino em breve"). */
export function NewsletterForm({ inverse = false }: { inverse?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "busy") return;
    setState("busy");
    setMsg(null);
    try {
      const res = await subscribeNewsletterAction(email);
      if (res.ok) setState("done");
      else {
        setState("error");
        setMsg(res.error ?? "Não deu certo. Tente de novo.");
      }
    } catch {
      setState("error");
      setMsg("Não deu certo. Tente de novo.");
    }
  }

  if (state === "done")
    return (
      <p className={`text-sm ${inverse ? "text-white/70" : "text-muted"}`}>
        E-mail cadastrado. Você recebe as novidades primeiro.
      </p>
    );

  return (
    <form onSubmit={submit} className="w-full space-y-2">
      <div className="flex gap-2">
        {/* `text-base` no celular: abaixo de 16px o iOS dá zoom ao focar. */}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          aria-label="E-mail para receber novidades"
          className={`h-12 min-w-0 flex-1 rounded-xs border bg-transparent px-4 text-base outline-none sm:text-sm ${
            inverse
              ? "border-white/30 text-white placeholder:text-white/50 focus:border-white"
              : "border-border placeholder:text-muted focus:border-foreground"
          }`}
        />
        <button
          type="submit"
          disabled={state === "busy"}
          className={`inline-flex h-12 shrink-0 items-center justify-center rounded-xs px-5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 ${
            inverse ? "bg-white text-black" : "bg-foreground text-background"
          }`}
        >
          {state === "busy" ? "Enviando…" : "Cadastrar"}
        </button>
      </div>
      {msg && (
        <p className={`text-xs ${inverse ? "text-red-300" : "text-red-600"}`}>
          {msg}
        </p>
      )}
    </form>
  );
}
