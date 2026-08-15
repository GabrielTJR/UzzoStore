"use client";

import { useState } from "react";
import { subscribeNewsletterAction } from "@/app/newsletter-actions";

/** Captura de e-mail do rodapé — o único canal de remarketing que a loja é
 * dona (Instagram é terreno alugado). */
export function NewsletterForm() {
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
      <p className="text-sm text-muted">
        Pronto! Você vai receber as novidades primeiro. 🎉
      </p>
    );

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          aria-label="E-mail para receber novidades"
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:border-foreground"
        />
        <button
          type="submit"
          disabled={state === "busy"}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-foreground px-4 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {state === "busy" ? "…" : "Quero"}
        </button>
      </div>
      {msg && <p className="text-xs text-red-600">{msg}</p>}
    </form>
  );
}
