import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/products";
import { ProductView } from "@/components/product-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Produto não encontrado" };
  return {
    title: product.metaTitle ?? product.name,
    description: product.metaDescription ?? undefined,
  };
}

export default async function ProdutoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  return (
    <article className="mx-auto max-w-6xl px-6 py-12">
      <nav className="mb-8 text-sm text-muted">
        <Link href="/produtos" className="hover:text-foreground">
          Produtos
        </Link>
        {product.category && (
          <>
            {" · "}
            <span>{product.category}</span>
          </>
        )}
      </nav>

      <ProductView
        slug={product.slug}
        name={product.name}
        category={product.category}
        description={product.description}
        price={product.price}
        basePrice={product.basePrice}
        promoPrice={product.promoPrice}
        colors={product.colors}
      />
    </article>
  );
}
