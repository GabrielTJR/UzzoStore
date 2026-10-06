import type { Metadata } from "next";
import { requireArea } from "@/lib/admin";
import { getAdminCategories } from "@/lib/admin-products";
import { PageHeader, Panel } from "../admin-ui";
import { NewCategoryForm, CategoryRow } from "../category-forms";

export const metadata: Metadata = { title: "Categorias" };

export default async function CategoriasPage() {
  await requireArea("categorias");
  const categories = await getAdminCategories();
  const vazias = categories.filter((c) => c.products === 0).length;

  return (
    <>
      <PageHeader
        title="Categorias"
        description="Tipos de roupa (camisa, camiseta, bermuda…) usados no menu, nos atalhos da página inicial, nos filtros e no cadastro de produtos."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 text-sm text-muted lg:px-5">
            <span>
              {categories.length}{" "}
              {categories.length === 1 ? "categoria" : "categorias"}
            </span>
            {vazias > 0 && <span>{vazias} sem nenhum produto</span>}
          </div>
          <div className="hidden grid-cols-[minmax(0,1fr)_13rem_8rem_auto] gap-x-6 border-b border-border px-4 py-2 text-xs text-muted md:grid lg:px-5">
            <span>Nome</span>
            <span>Na loja</span>
            <span>No painel</span>
            <span className="w-12" />
          </div>
          <ul className="divide-y divide-border">
            {categories.map((c) => (
              <CategoryRow key={c.id} category={c} />
            ))}
            {categories.length === 0 && (
              <li className="p-8 text-center text-sm text-muted">
                Nenhuma categoria ainda. Crie a primeira ao lado.
              </li>
            )}
          </ul>
        </Panel>

        <div className="space-y-6">
          <Panel className="p-5">
            <h2 className="mb-4 font-semibold">Nova categoria</h2>
            <NewCategoryForm />
          </Panel>
          <Panel className="space-y-2 p-5 text-sm text-muted">
            <p>
              A categoria aparece na loja sozinha, em Masculino ou Feminino,
              quando tiver ao menos uma peça ativa daquele departamento (unissex
              conta nos dois).
            </p>
            <p>
              Excluir não apaga produtos: eles ficam sem categoria até você
              escolher outra.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
