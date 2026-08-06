import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "../entrar/auth-forms";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function EsqueciSenhaPage() {
  return (
    <section className="mx-auto max-w-sm px-6 py-16">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        Esqueci minha senha
      </h1>
      <p className="mt-2 mb-8 text-sm text-muted">
        Informe o e-mail da conta e enviamos um link para criar uma nova senha.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-sm">
        <Link
          href="/entrar"
          className="text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Voltar para entrar
        </Link>
      </p>
    </section>
  );
}
