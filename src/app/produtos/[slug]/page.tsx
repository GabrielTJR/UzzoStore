import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/products";
import { formatBRL } from "@/lib/format";
import { ProductPlaceholder } from "@/components/product-placeholder";
import { AddToCart } from "@/components/add-to-cart";

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

  const inStock = product.variants.some((v) => v.qty > 0);

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

      <div className="grid gap-10 md:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-border">
          <ProductPlaceholder />
        </div>

        <div>
          {product.category && (
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              {product.category}
            </p>
          )}
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">
            {product.name}
          </h1>
          {product.price != null && (
            <p className="mt-4 text-2xl">{formatBRL(product.price)}</p>
          )}
          <p className="mt-2 text-sm text-muted">
            {inStock ? "Em estoque" : "Indisponível no momento"}
          </p>

          <div className="mt-8">
            <AddToCart
              slug={product.slug}
              name={product.name}
              variants={product.variants}
            />
          </div>

          {product.description && (
            <div className="mt-10 border-t border-border pt-6">
              <p className="text-sm leading-relaxed text-muted">
                {product.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
