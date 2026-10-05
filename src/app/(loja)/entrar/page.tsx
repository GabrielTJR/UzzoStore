import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/customer";
import { LoginForm } from "./auth-forms";
import { AuthShell } from "./auth-shell";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage() {
  if (await getCurrentUser()) redirect("/conta");

  return (
    <AuthShell
      title="Entrar"
      description="Acompanhe seus pedidos, guarde endereços e salve as peças favoritas."
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
