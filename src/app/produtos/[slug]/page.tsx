import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/products";
import { ProductView } from "@/components/product-view";
import { RelatedProducts } from "@/components/related-products";
import { BenefitsStrip } from "@/components/benefits-strip";
import { categorySlug } from "@/lib/categories";
import { getAdminUser } from "@/lib/admin";
import { getSessionUser } from "@/lib/session";
import { getWishlistIds } from "@/lib/wishlist";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Produto não encontrado" };

  const title = product.metaTitle ?? product.name;
  const description =
    product.metaDescription ??
    product.description ??
    `${product.name} na Uzzo Store.`;
  // Sem isso, o link colado no WhatsApp/Instagram aparece sem foto — e a loja
  // vende justamente por esses canais.
  const image = product.colors.find((c) => c.gallery.length > 0)?.gallery[0];

  return {
    title,
    description,
    alternates: { canonical: `/produtos/${product.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/produtos/${product.slug}`,
      images: image ? [{ url: image, alt: product.name }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProdutoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [product, adminUser, sessionUser, favorites] = await Promise.all([
    getProductBySlug(slug),
    getAdminUser(),
    getSessionUser(),
    getWishlistIds(),
  ]);
  if (!product) notFound();
  const isAdmin = !!adminUser;

  return (
    <>
      <article className="mx-auto max-w-6xl px-6 py-8 md:py-12">
        <nav
          aria-label="Você está em"
          className="mb-6 text-sm text-muted md:mb-8"
        >
          <Link href="/produtos" className="hover:text-foreground">
            Produtos
          </Link>
          {product.category && (
            <>
              {" · "}
              {/* Categoria clicável: leva ao catálogo já filtrado. */}
              <Link
                href={`/produtos?categorias=${categorySlug(product.category)}`}
                className="hover:text-foreground"
              >
                {product.category}
              </Link>
            </>
          )}
        </nav>

        <ProductView
          productId={product.id}
          slug={product.slug}
          name={product.name}
          category={product.category}
          description={product.description}
          price={product.price}
          basePrice={product.basePrice}
          promoPrice={product.promoPrice}
          featured={product.featured}
          isAdmin={isAdmin}
          colors={product.colors}
          measurement={product.measurement}
          isLogged={!!sessionUser}
          isFavorite={favorites.has(product.id)}
        />

        <RelatedProducts
          categoryName={product.category}
          excludeId={product.id}
          backTo={`/produtos/${product.slug}`}
          isAdmin={isAdmin}
          isLogged={!!sessionUser}
          favorites={favorites}
        />
      </article>
      <BenefitsStrip />
    </>
  );
}
