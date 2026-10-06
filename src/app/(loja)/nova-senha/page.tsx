import type { Metadata } from "next";
import { NewPasswordForm } from "../entrar/auth-forms";
import { AuthShell } from "../entrar/auth-shell";

export const metadata: Metadata = { title: "Nova senha" };

/** Depois do código do "esqueci a senha" (e dos links antigos de
 * recuperação, que o /auth/callback troca por sessão). */
export default function NovaSenhaPage() {
  return (
    <AuthShell
      title="Nova senha"
      description="Escolha uma senha nova para sua conta."
    >
      <NewPasswordForm />
    </AuthShell>
  );
}
