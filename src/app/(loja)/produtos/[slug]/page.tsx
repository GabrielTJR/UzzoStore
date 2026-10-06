import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/products";
import { ProductView } from "@/components/product-view";
import { RelatedProducts } from "@/components/related-products";
import { BenefitsStrip } from "@/components/benefits-strip";
import { shippingConfigured } from "@/lib/shipping";
import { siteUrl } from "@/lib/site-url";
import { categorySlug } from "@/lib/categories";

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

/**
 * Estática por produto: gerada na primeira visita e guardada pronta, derrubada
 * pela etiqueta `catalogo` (mutação de produto, estoque, pagamento). Nada aqui
 * depende de quem olha — coração e atalhos de admin vêm do navegador
 * (`lib/viewer.ts`). 5 min é o teto para a expiração de reserva pelo pg_cron,
 * que não consegue avisar o cache.
 */
export const revalidate = 300;

export default async function ProdutoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  // Dados estruturados (schema.org/Product): é o que deixa o Google mostrar
  // preço e "em estoque" no resultado da busca. Sai do mesmo produto em cache
  // — custo zero. `<` escapado: o JSON vai dentro de um <script>, e um nome ou
  // descrição com "</script>" fecharia a tag.
  const temSaldo = product.colors.some((c) =>
    c.variants.some((v) => v.qty > 0),
  );
  const url = `${siteUrl()}/produtos/${product.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url,
    image: product.colors.flatMap((c) => c.gallery.slice(0, 1)).slice(0, 6),
    ...(product.description ? { description: product.description } : {}),
    brand: { "@type": "Brand", name: product.brand || "Uzzo Store" },
    ...(product.reference ? { sku: product.reference } : {}),
    ...(product.price != null
      ? {
          offers: {
            "@type": "Offer",
            url,
            priceCurrency: "BRL",
            price: product.price.toFixed(2),
            availability: temSaldo
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <article className="px-page pb-10 pt-4 md:py-10">
        <nav
          aria-label="Você está em"
          className="mb-4 text-sm text-muted md:mb-8"
        >
          <Link href="/produtos" className="hover:text-foreground">
            Produtos
          </Link>
          {product.category && (
            <>
              <span aria-hidden className="mx-2">
                /
              </span>
              {/* Categoria clicável: leva ao catálogo já filtrado. É endereço
                  de faceta, então sem prefetch. */}
              <Link
                href={`/${product.department}/${categorySlug(product.category)}`}
                prefetch={false}
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
          description={product.description}
          price={product.price}
          basePrice={product.basePrice}
          promoPrice={product.promoPrice}
          featured={product.featured}
          colors={product.colors}
          measurement={product.measurement}
        />

        <RelatedProducts
          categoryName={product.category}
          excludeId={product.id}
          backTo={`/produtos/${product.slug}`}
        />
      </article>
      <BenefitsStrip freteAtivo={shippingConfigured()} />
    </>
  );
}
