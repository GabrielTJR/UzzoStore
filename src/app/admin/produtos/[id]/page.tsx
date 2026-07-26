import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { getAdminProduct } from "@/lib/admin-products";
import { ProductInfoForm } from "../../product-info-form";
import { DeleteProductButton } from "../../delete-product-button";
import {
  saveVariantAction,
  deleteVariantAction,
  addPhotosAction,
  removePhotoAction,
} from "../../actions";

export const metadata: Metadata = { title: "Editar produto" };

const smallField =
  "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground";

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
                  <button className="mt-1 text-xs text-red-600 underline-offset-4 hover:underline dark:text-red-400">
                    Remover
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        <form
          action={addPhotosAction}
          className="flex flex-wrap items-center gap-3"
        >
          <input type="hidden" name="productId" value={product.id} />
          <input
            type="file"
            name="images"
            accept="image/*"
            multiple
            required
            className="text-sm text-muted file:mr-3 file:rounded-full file:border file:border-border file:bg-transparent file:px-4 file:py-2 file:text-sm file:text-foreground"
          />
          <button className="h-10 rounded-full border border-border px-5 text-sm font-medium transition-colors hover:border-foreground">
            Enviar fotos
          </button>
        </form>
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
            <div
              key={v.id}
              className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3"
            >
              <form
                action={saveVariantAction}
                className="flex flex-1 flex-wrap items-end gap-3"
              >
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="variantId" value={v.id} />
                <label className="text-xs text-muted">
                  Tamanho
                  <input
                    name="size"
                    defaultValue={v.size ?? ""}
                    placeholder="Único"
                    className={`${smallField} mt-1 w-24`}
                  />
                </label>
                <label className="text-xs text-muted">
                  Preço (R$)
                  <input
                    name="price"
                    inputMode="decimal"
                    required
                    defaultValue={v.price ?? ""}
                    placeholder="0,00"
                    className={`${smallField} mt-1 w-28`}
                  />
                </label>
                <label className="text-xs text-muted">
                  Estoque
                  <input
                    name="qty"
                    type="number"
                    min="0"
                    defaultValue={v.qty}
                    className={`${smallField} mt-1 w-24`}
                  />
                </label>
                <button className="h-9 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90">
                  Salvar
                </button>
              </form>
              <form action={deleteVariantAction}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="variantId" value={v.id} />
                <button className="h-9 px-2 text-sm text-red-600 underline-offset-4 hover:underline dark:text-red-400">
                  Excluir
                </button>
              </form>
            </div>
          ))}
        </div>

        {/* Adicionar variante */}
        <form
          action={saveVariantAction}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3"
        >
          <input type="hidden" name="productId" value={product.id} />
          <label className="text-xs text-muted">
            Tamanho
            <input
              name="size"
              placeholder="Único"
              className={`${smallField} mt-1 w-24`}
            />
          </label>
          <label className="text-xs text-muted">
            Preço (R$)
            <input
              name="price"
              inputMode="decimal"
              required
              placeholder="0,00"
              className={`${smallField} mt-1 w-28`}
            />
          </label>
          <label className="text-xs text-muted">
            Estoque
            <input
              name="qty"
              type="number"
              min="0"
              defaultValue={0}
              className={`${smallField} mt-1 w-24`}
            />
          </label>
          <button className="h-9 rounded-full border border-border px-5 text-sm font-medium transition-colors hover:border-foreground">
            + Adicionar tamanho
          </button>
        </form>
      </div>
    </section>
  );
}
