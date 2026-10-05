import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "../entrar/auth-forms";
import { AuthShell } from "../entrar/auth-shell";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function EsqueciSenhaPage() {
  return (
    <AuthShell
      title="Esqueci a senha"
      description="Informe o e-mail da conta e enviamos um link para criar uma nova senha."
      footer={
        <div className="space-y-1 border-t border-border pt-5 text-sm text-muted">
          <p>
            Com pressa?{" "}
            <Link
              href="/entrar?modo=codigo"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Entre com um código por e-mail
            </Link>{" "}
            — chega na hora, sem precisar de senha.
          </p>
        </div>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
