import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/customer";
import { SignupForm } from "../entrar/auth-forms";
import { AuthShell } from "../entrar/auth-shell";

export const metadata: Metadata = { title: "Criar conta" };

export default async function CadastroPage() {
  if (await getCurrentUser()) redirect("/conta");

  return (
    <AuthShell
      title="Criar conta"
      description="Guarde seus endereços, acompanhe pedidos e salve peças favoritas."
    >
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
