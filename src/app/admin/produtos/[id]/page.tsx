import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { getAdminProduct } from "@/lib/admin-products";
import { SubmitButton } from "@/components/submit-button";
import { ProductInfoForm } from "../../product-info-form";
import { DeleteProductButton } from "../../delete-product-button";
import { VariantForm } from "../../variant-form";
import { AddPhotosForm } from "../../add-photos-form";
import { removePhotoAction } from "../../actions";

export const metadata: Metadata = { title: "Editar produto" };

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await getAdminUser())) redirect("/admin/login");
  const { id } = await params;
  const product = await getAdminProduct(id);
  if (!product) notFound();

  return (
    <section className="mx-auto max-w-3xl space-y-12 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            ← Produtos
          </Link>
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">
            {product.name}
          </h1>
          {product.slug && product.active && (
            <Link
              href={`/produtos/${product.slug}`}
              target="_blank"
              className="mt-1 inline-block text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              Ver na loja ↗
            </Link>
          )}
        </div>
        <DeleteProductButton productId={product.id} />
      </header>

      {/* Informações */}
      <div>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-muted">
          Informações
        </h2>
        <ProductInfoForm product={product} />
      </div>

      {/* Fotos */}
      <div>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-muted">
          Fotos ({product.gallery.length})
        </h2>

        {product.gallery.length > 0 && (
          <div className="mb-6 grid grid-cols-3 gap-4 sm:grid-cols-4">
            {product.gallery.map((url) => (
              <div key={url}>
                <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-border">
                  <Image
                    src={url}
                    alt="Foto do produto"
                    fill
                    sizes="160px"
                    className="object-cover"
                  />
                </div>
                <form action={removePhotoAction}>
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="url" value={url} />
                  <SubmitButton
                    pendingText="Removendo…"
                    className="mt-1 text-xs text-red-600 underline-offset-4 hover:underline dark:text-red-400"
                  >
                    Remover
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
        )}

        <AddPhotosForm productId={product.id} />
      </div>

      {/* Variantes */}
      <div>
        <h2 className="mb-1 text-sm font-medium uppercase tracking-[0.2em] text-muted">
          Tamanhos, preço e estoque
        </h2>
        <p className="mb-4 text-xs text-muted">
          Enquanto o Linx não está conectado, preço e estoque são controlados
          aqui. Deixe o tamanho em branco para peça única.
        </p>

        <div className="space-y-2">
          {product.variants.map((v) => (
            <VariantForm key={v.id} productId={product.id} variant={v} />
          ))}
        </div>

        <div className="mt-4">
          <VariantForm productId={product.id} />
        </div>
      </div>
    </section>
  );
}
