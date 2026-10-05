import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import {
  getAdminProduct,
  getAllColors,
  getMeasurementModelOptions,
} from "@/lib/admin-products";
import { getCategories } from "@/lib/products";
import { ProductEditView } from "./product-edit-view";

export const metadata: Metadata = { title: "Editar produto" };

/** Edição de um produto. O desenho fica em `product-edit-view.tsx`. */
export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [product, allColors, categories, measurementModels] = await Promise.all(
    [
      getAdminProduct(id),
      getAllColors(),
      getCategories(),
      getMeasurementModelOptions(),
    ],
  );
  if (!product) notFound();

  const usedColorIds = new Set(product.colors.map((c) => c.colorId));
  const availableColors = allColors.filter((c) => !usedColorIds.has(c.id));

  return (
    <ProductEditView
      product={product}
      availableColors={availableColors}
      categories={categories}
      measurementModels={measurementModels}
    />
  );
}
