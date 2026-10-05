import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getAdminProducts } from "@/lib/admin-products";
import { ProductsView, type ProductsSearch } from "./products-view";

export const metadata: Metadata = { title: "Produtos" };

/** Lista de produtos do painel. O desenho fica em `products-view.tsx`. */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<ProductsSearch>;
}) {
  await requireAdmin();
  const [sp, todos] = await Promise.all([searchParams, getAdminProducts()]);
  return <ProductsView todos={todos} sp={sp} />;
}
