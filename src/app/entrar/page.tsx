import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/customer";
import { LoginForm } from "./auth-forms";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage() {
  if (await getCurrentUser()) redirect("/conta");

  return (
    <section className="mx-auto max-w-sm px-6 py-16">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        Entrar
      </h1>
      <p className="mt-2 mb-8 text-sm text-muted">
        Acesse para acompanhar seus pedidos e agilizar suas compras.
      </p>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </section>
  );
}
