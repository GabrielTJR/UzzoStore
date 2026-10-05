import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getAllColors } from "@/lib/admin-products";
import { getCategories } from "@/lib/products";
import { NewProductForm } from "../../new-product-form";
import { PageHeader } from "../../admin-ui";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NovoProdutoPage() {
  await requireAdmin();
  const [colors, categories] = await Promise.all([
    getAllColors(),
    getCategories(),
  ]);

  return (
    // O container mede a área de trabalho (sem o menu lateral): é ela que
    // decide se o formulário cabe em duas colunas.
    <div className="@container max-w-6xl">
      <PageHeader
        back={{ href: "/admin/produtos", label: "Produtos" }}
        title="Novo produto"
        description="Cadastre o básico com pelo menos uma cor. Depois, na tela de edição, você adiciona as fotos e ajusta o estoque."
      />
      <NewProductForm colors={colors} categories={categories} />
    </div>
  );
}
