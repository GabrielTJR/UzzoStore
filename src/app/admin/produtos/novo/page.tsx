import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getAllColors } from "@/lib/admin-products";
import { getCategories } from "@/lib/products";
import { NewProductForm } from "../../new-product-form";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NovoProdutoPage() {
  await requireAdmin();
  const [colors, categories] = await Promise.all([
    getAllColors(),
    getCategories(),
  ]);

  return (
    <section className="max-w-2xl">
      <Link
        href="/admin/produtos"
        className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        ‹ Produtos
      </Link>
      <h1 className="font-display text-2xl font-bold lg:text-3xl">
        Novo produto
      </h1>
      <p className="mt-2 text-sm text-muted">
        Cadastre o básico com pelo menos uma cor. Depois você adiciona as fotos
        e ajusta o estoque na tela de edição.
      </p>

      <div className="mt-8 rounded-sm border border-border p-6">
        <NewProductForm colors={colors} categories={categories} />
      </div>
    </section>
  );
}
