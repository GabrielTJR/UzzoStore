import type { Metadata } from "next";
import { NewPasswordForm } from "../entrar/auth-forms";
import { AuthShell } from "../entrar/auth-shell";

export const metadata: Metadata = { title: "Nova senha" };

/** Destino do link de recuperação (o /auth/callback troca o code por sessão). */
export default function NovaSenhaPage() {
  return (
    <AuthShell title="Nova senha" description="Escolha uma senha nova para sua conta.">
      <NewPasswordForm />
    </AuthShell>
  );
}
