import type { Metadata } from "next";
import { getAdminFor, requireArea } from "@/lib/admin";
import { getAdminProducts } from "@/lib/admin-products";
import { ProductsView, type ProductsSearch } from "./products-view";

export const metadata: Metadata = { title: "Produtos" };

/** Lista de produtos do painel. O desenho fica em `products-view.tsx`. */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<ProductsSearch>;
}) {
  await requireArea("produtos");
  const [sp, todos, destaca] = await Promise.all([
    searchParams,
    getAdminProducts(),
    getAdminFor("pagina-inicial"),
  ]);
  return <ProductsView todos={todos} sp={sp} podeDestacar={!!destaca} />;
}
