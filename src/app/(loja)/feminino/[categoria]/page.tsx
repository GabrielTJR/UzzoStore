import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Catalog } from "@/components/catalog";
import { EMPTY_CATALOG } from "@/lib/catalog-url";
import { categorySlug } from "@/lib/categories";
import { getDepartmentCategory } from "@/lib/products";

/**
 * Categoria do Feminino em ENDEREÇO LIMPO (`/feminino/blusas`) — mesmo motivo de `masculino/[categoria]`.
 *
 * Existe por causa do Firewall da Vercel: toda URL de faceta com
 * `?categorias=` passa por um desafio ("Verificando seu navegador"), ligado em
 * ago/2026 contra robôs que varriam as combinações de filtro. O menu e os
 * atalhos da home apontavam para essas URLs, então todo cliente que tocava numa
 * categoria via a tela de verificação. Aqui são poucos endereços fixos (um por
 * categoria), sem espaço combinatório — o desafio não precisa valer.
 *
 * Filtros aplicados DENTRO desta página continuam indo para `/produtos?…`.
 *
 * Só existe a categoria que tem peça ativa NESTE departamento (unissex conta
 * nos dois). O resto é 404: `/feminino/polos` sem polo feminina seria uma
 * página vazia indexável — e, enquanto o Feminino não tem peças, toda
 * `/feminino/<categoria>` é 404.
 */
function categoriaPorSlug(slug: string) {
  return getDepartmentCategory("feminino", slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoria: string }>;
}): Promise<Metadata> {
  const cat = await categoriaPorSlug((await params).categoria);
  if (!cat) return {};
  return {
    title: `${cat.name} femininas`,
    description: `${cat.name} da Uzzo Store, com tecidos que não amassam e secam rápido.`,
    alternates: { canonical: `/feminino/${categorySlug(cat.name)}` },
  };
}

export default async function FemininoCategoriaPage({
  params,
}: {
  params: Promise<{ categoria: string }>;
}) {
  const { categoria } = await params;
  const cat = await categoriaPorSlug(categoria);
  if (!cat) notFound();
  return (
    <Catalog
      state={{
        ...EMPTY_CATALOG,
        department: "feminino",
        categorias: [categoria],
      }}
      title={cat.name}
      homePath="/feminino"
    />
  );
}
