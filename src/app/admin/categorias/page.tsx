import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getAdminCategories } from "@/lib/admin-products";
import { NewCategoryForm, CategoryRow } from "../category-forms";

export const metadata: Metadata = { title: "Categorias" };

export default async function CategoriasPage() {
  await requireAdmin();
  const categories = await getAdminCategories();

  return (
    <section className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold lg:text-3xl">
        Categorias
      </h1>
      <p className="mt-2 text-sm text-muted">
        Tipos de roupa (camisa, camiseta, bermuda…) usados no menu, nos filtros
        e no cadastro de produtos. Excluir uma categoria deixa os produtos dela
        sem categoria (não apaga os produtos).
      </p>

      <div className="mt-8 rounded-sm border border-dashed border-border p-5">
        <p className="mb-3 text-xs font-medium text-muted">
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
          <p className="rounded-xs border border-dashed border-border p-4 text-sm text-muted">
            Nenhuma categoria ainda.
          </p>
        )}
      </div>
    </section>
  );
}
