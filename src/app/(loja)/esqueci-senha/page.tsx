import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "../entrar/auth-forms";
import { AuthShell } from "../entrar/auth-shell";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function EsqueciSenhaPage() {
  return (
    <AuthShell
      title="Esqueci a senha"
      description="Informe o e-mail da conta. Enviamos um código e, com ele, você escolhe a senha nova aqui mesmo."
      footer={
        <div className="space-y-1 border-t border-border pt-5 text-sm text-muted">
          <p>
            Lembrou a senha?{" "}
            <Link
              href="/entrar"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Entrar
            </Link>
          </p>
        </div>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
