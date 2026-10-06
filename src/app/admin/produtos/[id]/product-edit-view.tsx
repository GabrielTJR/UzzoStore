import Image from "next/image";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import type {
  AdminProduct,
  AdminProductColor,
  ColorOption,
} from "@/lib/admin-products";
import type { StoreCategory } from "@/lib/categories";
import { displayColor } from "@/lib/color-name";
import { formatBRL } from "@/lib/format";
import { installmentsFor } from "@/lib/installments";
import type { MeasurementModelOption } from "@/lib/measurements";
import { displayProductName } from "@/lib/product-name";
import { removePhotoAction } from "@/app/admin/actions";
import { AddColorForm } from "@/app/admin/add-color-form";
import { AddPhotosForm } from "@/app/admin/add-photos-form";
import { DeleteProductButton } from "@/app/admin/delete-product-button";
import { PageHeader, Panel, secondaryButton } from "@/app/admin/admin-ui";
import { ProductInfoForm } from "@/app/admin/product-info-form";
import { RemoveColorButton } from "@/app/admin/remove-color-button";
import { VariantForm } from "@/app/admin/variant-form";

const sectionTitle = "font-display text-base font-bold";

/**
 * EDITAR PRODUTO — o desenho da tela (dados e autorização ficam no page.tsx).
 *
 * Duas colunas quando a ÁREA DE TRABALHO tem ≥ 56rem (notebook com o menu
 * lateral aberto): à esquerda o que vale para o produto inteiro — prévia da
 * loja, informações, preço; à direita o que é por cor — fotos e grade de
 * tamanho/estoque. É a mesma divisão do banco (preço GLOBAL no produto, fotos
 * e estoque por cor), então a tela ensina o modelo sem precisar de aviso.
 * Abaixo disso, uma coluna só, na mesma ordem.
 */
export function ProductEditView({
  product,
  availableColors,
  categories,
  measurementModels,
  podeDestacar,
}: {
  product: AdminProduct;
  availableColors: ColorOption[];
  categories: StoreCategory[];
  measurementModels: MeasurementModelOption[];
  /** Cargo alcança a página inicial (destaques). */
  podeDestacar: boolean;
}) {
  const pecas = product.colors.reduce(
    (n, c) => n + c.variants.reduce((m, v) => m + Math.max(0, v.qty), 0),
    0,
  );

  return (
    <div className="@container">
      <PageHeader
        back={{ href: "/admin/produtos", label: "Produtos" }}
        title={displayProductName(product.name)}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className={`inline-flex items-center gap-1.5 ${product.active ? "text-foreground" : ""}`}
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${product.active ? "bg-green-600" : "bg-muted/50"}`}
              />
              {product.active ? "Ativo na loja" : "Inativo, fora da loja"}
            </span>
            {product.reference && <span>Ref. {product.reference}</span>}
            <span>
              {pecas} {pecas === 1 ? "peça" : "peças"} em estoque
            </span>
          </span>
        }
      >
        {product.slug && product.active && (
          <Link
            href={`/produtos/${product.slug}`}
            target="_blank"
            prefetch={false}
            className={secondaryButton}
          >
            Ver na loja ↗
          </Link>
        )}
      </PageHeader>

      <div className="grid items-start gap-6 @4xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] @6xl:grid-cols-[minmax(0,27rem)_minmax(0,1fr)]">
        {/* Coluna do PRODUTO */}
        <div className="space-y-6">
          <ProductPreview product={product} />

          <Panel className="p-5">
            <h2 className={`${sectionTitle} mb-4`}>Informações</h2>
            <ProductInfoForm
              product={product}
              categories={categories}
              models={measurementModels}
              podeDestacar={podeDestacar}
            />
          </Panel>

          <div className="flex items-center justify-between gap-4 rounded-sm border border-dashed border-border px-5 py-3">
            <p className="text-xs text-muted">
              Excluir apaga o produto, as cores, as fotos e o estoque.
            </p>
            <div className="shrink-0">
              <DeleteProductButton productId={product.id} />
            </div>
          </div>
        </div>

        {/* Coluna das CORES */}
        <div className="space-y-4">
          <div>
            <h2 className={sectionTitle}>Cores, fotos e estoque</h2>
            <p className="mt-1 text-xs text-muted">
              Cada cor tem as próprias fotos e a própria grade. O preço é o
              mesmo para todas. Tamanho em branco é peça única.
            </p>
          </div>

          {product.colors.length === 0 && (
            <p className="rounded-sm border border-dashed border-border bg-background p-5 text-sm text-muted">
              Nenhuma cor ainda. Adicione uma cor abaixo para poder cadastrar
              fotos e estoque.
            </p>
          )}

          {product.colors.map((color) => (
            <ColorPanel key={color.id} productId={product.id} color={color} />
          ))}

          <div className="rounded-sm border border-dashed border-border bg-background p-5">
            <h3 className="mb-3 text-sm font-semibold">Adicionar cor</h3>
            <AddColorForm
              productId={product.id}
              availableColors={availableColors}
            />
            <p className="mt-3 text-xs text-muted">
              As cores saem do{" "}
              <Link
                href="/admin/cores"
                className="underline underline-offset-4 hover:text-foreground"
              >
                cadastro geral de cores
              </Link>
              . Dá para criar uma nova aqui na hora.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Como o card aparece na loja, com o que está SALVO (a vitrine lê do banco,
 * então a prévia também — muda depois de "Salvar informações"). Mesmas regras
 * do card: selo só a partir de 5%, parcela de `installmentsFor`.
 */
function ProductPreview({ product }: { product: AdminProduct }) {
  const capa = product.colors.map((c) => c.gallery[0]).find(Boolean) ?? null;
  const promo =
    product.promoPrice != null && product.promoPrice > 0
      ? product.promoPrice
      : null;
  const preco = promo ?? product.price;
  const off =
    promo != null && product.price != null && product.price > 0
      ? Math.round((1 - promo / product.price) * 100)
      : null;
  const parcelas = installmentsFor(preco);

  return (
    <Panel className="flex gap-4 p-4">
      <div className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xs bg-surface @4xl:w-28">
        {capa ? (
          <Image
            src={capa}
            alt=""
            fill
            sizes="128px"
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs text-muted">
            Sem foto
          </span>
        )}
        {off != null && off >= 5 && (
          <span className="absolute bottom-1.5 left-1.5 rounded-xs bg-accent px-1 py-0.5 text-[0.65rem] font-bold leading-none text-accent-foreground">
            −{off}%
          </span>
        )}
      </div>
      <div className="min-w-0 py-0.5">
        <p className="text-xs text-muted">
          {product.active ? "Na loja" : "Prévia (inativo, não está na loja)"}
        </p>
        {product.colors.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {product.colors.map((c) => (
              <span
                key={c.id}
                title={displayColor(c.name)}
                className="h-3.5 w-3.5 rounded-full border border-border"
                style={c.hex ? { backgroundColor: c.hex } : undefined}
              />
            ))}
          </div>
        )}
        <p className="mt-2 text-sm font-medium leading-snug">
          {displayProductName(product.name)}
        </p>
        {preco != null ? (
          <>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-bold">{formatBRL(preco)}</span>
              {promo != null && product.price != null && (
                <span className="text-xs text-muted line-through">
                  {formatBRL(product.price)}
                </span>
              )}
            </p>
            {parcelas && (
              <p className="mt-0.5 text-xs text-muted">
                {parcelas.count}x de {formatBRL(parcelas.value)}
                {parcelas.semJuros ? " sem juros" : ""}
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">Sem preço</p>
        )}
      </div>
    </Panel>
  );
}

/** Uma cor do produto: cabeçalho com resumo, fotos e a grade de tamanhos. */
function ColorPanel({
  productId,
  color,
}: {
  productId: string;
  color: AdminProductColor;
}) {
  const nome = displayColor(color.name);
  const pecas = color.variants.reduce((n, v) => n + Math.max(0, v.qty), 0);
  const zerados = color.variants.filter((v) => v.qty <= 0).length;

  return (
    <Panel>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-5 py-3">
        <span
          aria-hidden
          className="h-5 w-5 shrink-0 rounded-full border border-border"
          style={color.hex ? { backgroundColor: color.hex } : undefined}
        />
        <h3 className="font-semibold">{nome}</h3>
        <span className="text-xs text-muted">
          {color.gallery.length} {color.gallery.length === 1 ? "foto" : "fotos"}
          , {pecas} {pecas === 1 ? "peça" : "peças"}
          {zerados > 0 &&
            `, ${zerados} ${zerados === 1 ? "tamanho zerado" : "tamanhos zerados"}`}
        </span>
        <div className="ml-auto">
          <RemoveColorButton
            productId={productId}
            productColorId={color.id}
            colorName={nome}
          />
        </div>
      </header>

      <div className="space-y-6 p-5">
        {/* Fotos */}
        <section>
          <h4 className="mb-2 text-xs font-medium text-muted">Fotos</h4>
          {color.gallery.length === 0 ? (
            <p className="mb-3 text-sm font-medium text-amber-700 dark:text-amber-400">
              Sem foto: na loja, esta cor aparece sem imagem.
            </p>
          ) : (
            <ul className="mb-3 grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-3">
              {color.gallery.map((url, i) => (
                <li key={url}>
                  <div className="relative aspect-[2/3] overflow-hidden rounded-xs border border-border bg-surface">
                    <Image
                      src={url}
                      alt={`Foto ${i + 1} de ${nome}`}
                      fill
                      sizes="128px"
                      className="object-cover"
                    />
                    {/* A 1ª foto é a que vai no card e na lista do painel. */}
                    {i === 0 && (
                      <span className="absolute left-1 top-1 rounded-xs bg-foreground px-1 py-0.5 text-[0.65rem] font-semibold leading-none text-background">
                        Capa
                      </span>
                    )}
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
                </li>
              ))}
            </ul>
          )}
          <AddPhotosForm productColorId={color.id} />
        </section>

        {/* Tamanhos e estoque */}
        <section>
          <h4 className="mb-2 text-xs font-medium text-muted">
            Tamanhos e estoque
          </h4>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(14.5rem,1fr))] gap-2">
            {color.variants.map((v) => (
              <VariantForm
                key={v.id}
                productId={productId}
                productColorId={color.id}
                variant={v}
              />
            ))}
            <VariantForm productId={productId} productColorId={color.id} />
          </div>
        </section>
      </div>
    </Panel>
  );
}
