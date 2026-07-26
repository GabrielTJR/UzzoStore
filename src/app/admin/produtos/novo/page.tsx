import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { NewProductForm } from "../../new-product-form";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NovoProdutoPage() {
  if (!(await getAdminUser())) redirect("/admin/login");

  return (
    <section className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/admin"
        className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        ← Voltar
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">
        Novo produto
      </h1>
      <p className="mt-2 text-sm text-muted">
        Cadastre o básico. Depois você adiciona fotos, tamanhos e estoque na
        tela de edição.
      </p>

      <div className="mt-8 rounded-lg border border-border p-6">
        <NewProductForm />
      </div>
    </section>
  );
}
