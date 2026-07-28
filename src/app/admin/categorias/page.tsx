import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getAdminCategories } from "@/lib/admin-products";
import { NewCategoryForm, CategoryRow } from "../category-forms";

export const metadata: Metadata = { title: "Categorias" };

export default async function CategoriasPage() {
  await requireAdmin();
  const categories = await getAdminCategories();

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/admin"
        className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        ← Produtos
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">
        Categorias
      </h1>
      <p className="mt-2 text-sm text-muted">
        Tipos de roupa (camisa, camiseta, bermuda…) usados no menu, nos filtros
        e no cadastro de produtos. Excluir uma categoria deixa os produtos dela
        sem categoria (não apaga os produtos).
      </p>

      <div className="mt-8 rounded-lg border border-dashed border-border p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
          Nova categoria
        </p>
        <NewCategoryForm />
      </div>

      <div className="mt-8 space-y-3">
        <p className="text-sm text-muted">
          {categories.length}{" "}
          {categories.length === 1 ? "categoria" : "categorias"}
        </p>
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} />
        ))}
        {categories.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">
            Nenhuma categoria ainda.
          </p>
        )}
      </div>
    </section>
  );
}
