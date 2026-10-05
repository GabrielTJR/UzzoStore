import type { Metadata } from "next";
import { Catalog } from "@/components/catalog";
import { parseCatalogParams } from "@/lib/catalog-url";

export const metadata: Metadata = {
  title: "Produtos",
  description:
    "Todas as peças da Uzzo Store: polos, camisas, calças e mais, com tecidos tecnológicos.",
  // Facetas (?categorias=&cores=...) canonizam para /produtos: buscador
  // indexa UMA página, não o produto cartesiano dos filtros.
  alternates: { canonical: "/produtos" },
};

/**
 * Catálogo completo e o destino de TODA faceta (filtro, busca, ordenação,
 * paginação). As seções de endereço limpo ficam em /masculino, /feminino e
 * /ofertas.
 */
export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = parseCatalogParams(await searchParams);
  return (
    <Catalog
      state={state}
      homePath={state.department ? `/${state.department}` : "/produtos"}
    />
  );
}
