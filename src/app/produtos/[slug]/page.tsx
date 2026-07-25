import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/products";
import { formatBRL } from "@/lib/format";
import { ProductPlaceholder } from "@/components/product-placeholder";

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

  const sizes = Array.from(
    new Set(product.variants.map((v) => v.size).filter((s): s is string => !!s)),
  );
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

          {sizes.length > 0 && (
            <div className="mt-8">
              <p className="text-sm font-medium">Tamanho</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <span
                    key={s}
                    className="flex h-10 min-w-10 items-center justify-center rounded-md border border-border px-3 text-sm"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8">
            <span className="inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground px-8 text-sm font-medium text-background opacity-60 sm:w-auto">
              Adicionar à sacola — em breve
            </span>
            <p className="mt-3 max-w-sm text-xs text-muted">
              Carrinho e checkout chegam na próxima fase. Por enquanto, fale com a
              gente pelo Instagram{" "}
              <a
                className="underline underline-offset-2"
                href="https://www.instagram.com/uzzostorebc/"
                target="_blank"
                rel="noopener noreferrer"
              >
                @uzzostorebc
              </a>
              .
            </p>
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
