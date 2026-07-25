"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-store";
import type { ProductVariant } from "@/lib/products";

/** Uma variante é comprável se está em estoque e tem preço válido. */
function isBuyable(v: ProductVariant): boolean {
  return v.qty > 0 && v.price != null && v.price > 0;
}

export function AddToCart({
  slug,
  name,
  variants,
}: {
  slug: string;
  name: string;
  variants: ProductVariant[];
}) {
  const addItem = useCart((s) => s.addItem);

  // Produto com grade de tamanhos? (senão é peça única / acessório)
  const hasSizes = variants.some((v) => v.size);
  const options = hasSizes ? variants.filter((v) => v.size) : variants;
  const buyable = options.filter(isBuyable);
  const anyBuyable = buyable.length > 0;

  // Auto-seleciona quando não há escolha de tamanho a fazer (peça única ou
  // um único tamanho comprável). Nunca seleciona algo não-comprável.
  const initialId = !hasSizes
    ? (buyable[0]?.id ?? null)
    : buyable.length === 1
      ? buyable[0].id
      : null;

  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [added, setAdded] = useState(false);

  const selected = options.find((v) => v.id === selectedId) ?? null;
  const canAdd = !!selected && isBuyable(selected);

  function handleAdd() {
    if (!selected || !isBuyable(selected)) return;
    addItem({
      variantId: selected.id,
      productSlug: slug,
      productName: name,
      size: selected.size,
      price: selected.price as number,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div>
      {hasSizes && (
        <div className="mb-6">
          <p className="text-sm font-medium">Tamanho</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {options.map((v) => {
              const disabled = !isBuyable(v);
              const isSelected = v.id === selectedId;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedId(v.id)}
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

      <button
        type="button"
        onClick={handleAdd}
        disabled={!canAdd}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40 sm:w-auto"
      >
        {added
          ? "Adicionado à sacola ✓"
          : !anyBuyable
            ? "Indisponível"
            : canAdd
              ? "Adicionar à sacola"
              : "Selecione um tamanho"}
      </button>
    </div>
  );
}
