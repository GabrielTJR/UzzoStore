import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/customer";
import { SignupForm } from "../entrar/auth-forms";

export const metadata: Metadata = { title: "Criar conta" };

export default async function CadastroPage() {
  if (await getCurrentUser()) redirect("/conta");

  return (
    <section className="mx-auto max-w-sm px-6 py-16">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        Criar conta
      </h1>
      <p className="mt-2 mb-8 text-sm text-muted">
        Guarde seus endereços, acompanhe pedidos e salve peças favoritas.
      </p>
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </section>
  );
}
