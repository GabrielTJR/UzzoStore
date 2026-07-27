import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getAllColors } from "@/lib/admin-products";
import { NewProductForm } from "../../new-product-form";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NovoProdutoPage() {
  await requireAdmin();
  const colors = await getAllColors();

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
        Cadastre o básico com pelo menos uma cor. Depois você adiciona as fotos
        e ajusta o estoque na tela de edição.
      </p>

      <div className="mt-8 rounded-lg border border-border p-6">
        <NewProductForm colors={colors} />
      </div>
    </section>
  );
}
