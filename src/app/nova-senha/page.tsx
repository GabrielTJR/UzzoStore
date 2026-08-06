import type { Metadata } from "next";
import { NewPasswordForm } from "../entrar/auth-forms";

export const metadata: Metadata = { title: "Nova senha" };

/** Destino do link de recuperação (o /auth/callback troca o code por sessão). */
export default function NovaSenhaPage() {
  return (
    <section className="mx-auto max-w-sm px-6 py-16">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        Nova senha
      </h1>
      <p className="mt-2 mb-8 text-sm text-muted">
        Escolha uma senha nova para sua conta.
      </p>
      <NewPasswordForm />
    </section>
  );
}
