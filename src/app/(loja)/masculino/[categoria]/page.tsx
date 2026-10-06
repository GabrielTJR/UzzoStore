import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Catalog } from "@/components/catalog";
import { EMPTY_CATALOG } from "@/lib/catalog-url";
import { categorySlug } from "@/lib/categories";
import { getDepartmentCategory } from "@/lib/products";

/**
 * Categoria do Masculino em ENDEREÇO LIMPO (`/masculino/polos`).
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
  return getDepartmentCategory("masculino", slug);
}

export const revalidate = 600;

/**
 * Lista vazia = nenhuma página no build, e cada uma é gerada na PRIMEIRA visita
 * e guardada pronta (ISR). Sem esta função a rota seria montada a cada visita.
 */
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoria: string }>;
}): Promise<Metadata> {
  const cat = await categoriaPorSlug((await params).categoria);
  if (!cat) return {};
  return {
    // "Masculino: Shorts" e não "Shorts masculinas": o nome da categoria é
    // livre, e a concordância errava com metade delas.
    title: `Masculino: ${cat.name}`,
    description: `${cat.name} da Uzzo Store, com tecidos que não amassam e secam rápido.`,
    alternates: { canonical: `/masculino/${categorySlug(cat.name)}` },
  };
}

export default async function MasculinoCategoriaPage({
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
        department: "masculino",
        categorias: [categoria],
      }}
      title={cat.name}
      homePath="/masculino"
    />
  );
}
