import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import {
  getAdminProduct,
  getAllColors,
  getMeasurementModelOptions,
} from "@/lib/admin-products";
import { getCategories } from "@/lib/products";
import { SubmitButton } from "@/components/submit-button";
import { ProductInfoForm } from "../../product-info-form";
import { DeleteProductButton } from "../../delete-product-button";
import { VariantForm } from "../../variant-form";
import { AddPhotosForm } from "../../add-photos-form";
import { AddColorForm } from "../../add-color-form";
import { RemoveColorButton } from "../../remove-color-button";
import { removePhotoAction } from "../../actions";

export const metadata: Metadata = { title: "Editar produto" };

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [product, allColors, categories, measurementModels] = await Promise.all(
    [
      getAdminProduct(id),
      getAllColors(),
      getCategories(),
      getMeasurementModelOptions(),
    ],
  );
  if (!product) notFound();

  const usedColorIds = new Set(product.colors.map((c) => c.colorId));
  const availableColors = allColors.filter((c) => !usedColorIds.has(c.id));

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
        <ProductInfoForm
          product={product}
          categories={categories}
          models={measurementModels}
        />
      </div>

      {/* Cores */}
      <div>
        <h2 className="mb-1 text-sm font-medium uppercase tracking-[0.2em] text-muted">
          Cores, fotos e estoque
        </h2>
        <p className="mb-6 text-xs text-muted">
          Cada cor tem suas próprias fotos e sua grade de tamanhos/estoque. O
          preço é o mesmo para todas as cores (definido acima). Deixe o tamanho
          em branco para peça única.
        </p>

        {product.colors.length === 0 && (
          <p className="mb-6 rounded-md border border-dashed border-border p-4 text-sm text-muted">
            Nenhuma cor ainda. Adicione uma cor abaixo para poder cadastrar
            fotos e estoque.
          </p>
        )}

        <div className="space-y-8">
          {product.colors.map((color) => (
            <div key={color.id} className="rounded-lg border border-border p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-5 w-5 rounded-full border border-border"
                    style={
                      color.hex ? { backgroundColor: color.hex } : undefined
                    }
                  />
                  <span className="font-medium">{color.name}</span>
                </div>
                <RemoveColorButton
                  productId={product.id}
                  productColorId={color.id}
                  colorName={color.name}
                />
              </div>

              {/* Fotos da cor */}
              <div className="mb-5">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                  Fotos ({color.gallery.length})
                </p>
                {color.gallery.length > 0 && (
                  <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {color.gallery.map((url) => (
                      <div key={url}>
                        <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-border">
                          <Image
                            src={url}
                            alt={`Foto ${color.name}`}
                            fill
                            sizes="160px"
                            className="object-cover"
                          />
                        </div>
                        <form action={removePhotoAction}>
                          <input
                            type="hidden"
                            name="productColorId"
                            value={color.id}
                          />
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
                <AddPhotosForm productColorId={color.id} />
              </div>

              {/* Tamanhos e estoque da cor */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                  Tamanhos e estoque
                </p>
                <div className="space-y-2">
                  {color.variants.map((v) => (
                    <VariantForm
                      key={v.id}
                      productId={product.id}
                      productColorId={color.id}
                      variant={v}
                    />
                  ))}
                </div>
                <div className="mt-3">
                  <VariantForm
                    productId={product.id}
                    productColorId={color.id}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Adicionar cor */}
        <div className="mt-8 rounded-lg border border-dashed border-border p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
            Adicionar cor
          </p>
          <AddColorForm
            productId={product.id}
            availableColors={availableColors}
          />
          <p className="mt-3 text-xs text-muted">
            Cores saem do{" "}
            <Link
              href="/admin/cores"
              className="underline underline-offset-4 hover:text-foreground"
            >
              cadastro geral de cores
            </Link>
            . Você também pode criar uma nova cor aqui na hora.
          </p>
        </div>
      </div>
    </section>
  );
}
