"use client";

import { useState } from "react";
import Image from "next/image";
import { useCart } from "@/lib/cart-store";
import { formatBRL } from "@/lib/format";
import { SlideTrack } from "@/components/slide-track";
import { CarouselArrows } from "@/components/carousel-arrows";
import { AdminProductOverlay } from "@/components/admin-product-overlay";
import type { ProductColor, ProductVariant } from "@/lib/products";

function variantBuyable(v: ProductVariant, price: number | null): boolean {
  return v.qty > 0 && price != null && price > 0;
}

function colorBuyable(c: ProductColor, price: number | null): boolean {
  return c.variants.some((v) => variantBuyable(v, price));
}

/** Tamanho auto-selecionado ao entrar numa cor: único comprável, ou peça única. */
function autoSize(color: ProductColor | undefined, price: number | null) {
  if (!color) return null;
  const hasSizes = color.variants.some((v) => v.size);
  if (!hasSizes) return null; // peça única: a variante é resolvida sozinha
  const buyable = color.variants.filter(
    (v) => v.size && variantBuyable(v, price),
  );
  return buyable.length === 1 ? buyable[0].size : null;
}

export function ProductView({
  productId,
  slug,
  name,
  category,
  description,
  price,
  basePrice,
  promoPrice,
  featured,
  isAdmin = false,
  colors,
}: {
  productId: string;
  slug: string;
  name: string;
  category: string | null;
  description: string | null;
  price: number | null;
  basePrice: number | null;
  promoPrice: number | null;
  featured: boolean;
  isAdmin?: boolean;
  colors: ProductColor[];
}) {
  const addItem = useCart((s) => s.addItem);

  // Cor inicial: a 1ª cor comprável, senão a 1ª cor.
  const firstBuyableColor =
    colors.find((c) => colorBuyable(c, price)) ?? colors[0] ?? null;

  const [selectedColorId, setSelectedColorId] = useState<string | null>(
    firstBuyableColor?.id ?? null,
  );
  const [selectedSize, setSelectedSize] = useState<string | null>(
    autoSize(firstBuyableColor ?? undefined, price),
  );
  const [imageIndex, setImageIndex] = useState(0);
  const [added, setAdded] = useState(false);
  const [qtyText, setQtyText] = useState("1");
  const qty = Math.max(1, parseInt(qtyText, 10) || 1);

  const color = colors.find((c) => c.id === selectedColorId) ?? null;
  const gallery = color?.gallery ?? [];
  const hasSizes = !!color && color.variants.some((v) => v.size);
  const sizeOptions = color
    ? hasSizes
      ? color.variants.filter((v) => v.size)
      : color.variants
    : [];

  const selectedVariant = !color
    ? null
    : hasSizes
      ? selectedSize
        ? (color.variants.find((v) => v.size === selectedSize) ?? null)
        : null
      : (color.variants[0] ?? null);

  const canAdd = !!selectedVariant && variantBuyable(selectedVariant, price);
  const anyBuyable = colors.some((c) => colorBuyable(c, price));

  function selectColor(id: string) {
    setSelectedColorId(id);
    const next = colors.find((c) => c.id === id);
    setSelectedSize(autoSize(next, price));
    setImageIndex(0);
  }

  function handleAdd() {
    if (!color || !selectedVariant || !variantBuyable(selectedVariant, price))
      return;
    addItem(
      {
        variantId: selectedVariant.id,
        productSlug: slug,
        productName: name,
        color: color.name,
        size: selectedVariant.size,
        price: price as number,
      },
      qty,
    );
    setQtyText("1");
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2500);
  }

  const hasPromo = promoPrice != null && basePrice != null;

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,22rem)_1fr] md:items-start lg:grid-cols-[minmax(0,26rem)_1fr]">
      {/* Galeria (troca conforme a cor) */}
      <div>
        <div className="relative">
          <SlideTrack
            key={selectedColorId ?? "none"}
            images={gallery}
            index={imageIndex}
            alt={color ? `${name} — ${color.name}` : name}
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
          {gallery.length > 1 && (
            <CarouselArrows
              onPrev={() =>
                setImageIndex((i) => (i - 1 + gallery.length) % gallery.length)
              }
              onNext={() => setImageIndex((i) => (i + 1) % gallery.length)}
            />
          )}
          {isAdmin && (
            <AdminProductOverlay productId={productId} featured={featured} />
          )}
        </div>
        {gallery.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {gallery.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setImageIndex(i)}
                className={`relative h-16 w-16 overflow-hidden rounded-md border ${
                  i === imageIndex ? "border-foreground" : "border-border"
                }`}
              >
                <Image
                  src={url}
                  alt={`${name} ${i + 1}`}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info + seleção */}
      <div>
        {category && (
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            {category}
          </p>
        )}
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">
          {name}
        </h1>

        {price != null && (
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-2xl">{formatBRL(price)}</span>
            {hasPromo && (
              <span className="text-base text-muted line-through">
                {formatBRL(basePrice as number)}
              </span>
            )}
          </div>
        )}
        <p className="mt-2 text-sm text-muted">
          {anyBuyable ? "Em estoque" : "Indisponível no momento"}
        </p>

        {/* Cor */}
        {colors.length > 0 && (
          <div className="mt-8">
            <p className="text-sm font-medium">
              Cor{color ? `: ${color.name}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {colors.map((c) => {
                const disabled = !colorBuyable(c, price);
                const isSelected = c.id === selectedColorId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectColor(c.id)}
                    title={c.name}
                    className={`flex h-10 items-center gap-2 rounded-full border px-3 text-sm transition-colors ${
                      isSelected
                        ? "border-foreground"
                        : "border-border hover:border-foreground"
                    } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-4 w-4 rounded-full border border-border"
                      style={c.hex ? { backgroundColor: c.hex } : undefined}
                    />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tamanho */}
        {hasSizes && (
          <div className="mt-6">
            <p className="text-sm font-medium">Tamanho</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {sizeOptions.map((v) => {
                const disabled = !variantBuyable(v, price);
                const isSelected = v.size === selectedSize;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedSize(v.size)}
                    className={`flex h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm transition-colors ${
                      isSelected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground"
                    } ${disabled ? "cursor-not-allowed opacity-40 line-through" : ""}`}
                  >
                    {v.size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quantidade */}
        {anyBuyable && (
          <div className="mt-6">
            <p className="text-sm font-medium">Quantidade</p>
            <div className="mt-3 inline-flex items-center rounded-md border border-border">
              <button
                type="button"
                aria-label="Diminuir quantidade"
                onClick={() => setQtyText(String(Math.max(1, qty - 1)))}
                disabled={qty <= 1}
                className="flex h-11 w-11 items-center justify-center text-lg text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                −
              </button>
              <input
                inputMode="numeric"
                aria-label="Quantidade"
                value={qtyText}
                onChange={(e) => setQtyText(e.target.value.replace(/\D/g, ""))}
                onBlur={() =>
                  setQtyText(String(Math.max(1, parseInt(qtyText, 10) || 1)))
                }
                className="h-11 w-14 border-x border-border bg-transparent text-center text-sm outline-none"
              />
              <button
                type="button"
                aria-label="Aumentar quantidade"
                onClick={() => setQtyText(String(qty + 1))}
                className="flex h-11 w-11 items-center justify-center text-lg text-muted transition-colors hover:text-foreground"
              >
                +
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40 sm:w-auto"
        >
          {added
            ? "Adicionado à sacola ✓"
            : !anyBuyable
              ? "Indisponível"
              : canAdd
                ? "Adicionar à sacola"
                : hasSizes
                  ? "Selecione um tamanho"
                  : "Selecione uma cor"}
        </button>

        {description && (
          <div className="mt-10 border-t border-border pt-6">
            <p className="text-sm leading-relaxed text-muted">{description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
