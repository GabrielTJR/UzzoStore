"use client";

import { useState } from "react";
import Image from "next/image";
import { useCart } from "@/lib/cart-store";
import { useCartUi } from "@/lib/cart-ui";
import { formatBRL } from "@/lib/format";
import { installmentsFor } from "@/lib/installments";
import { createStockAlertAction } from "@/app/produtos/[slug]/alert-actions";
import { SlideTrack } from "@/components/slide-track";
import { CarouselArrows } from "@/components/carousel-arrows";
import { AdminProductOverlay } from "@/components/admin-product-overlay";
import { MeasurementTable } from "@/components/measurement-table";
import { WishlistHeart } from "@/components/wishlist-heart";
import { displayColor } from "@/lib/color-name";
import type { ProductColor, ProductVariant } from "@/lib/products";
import type { MeasurementChart } from "@/lib/measurements";

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
  measurement,
  isLogged = false,
  isFavorite = false,
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
  measurement: MeasurementChart | null;
  isLogged?: boolean;
  isFavorite?: boolean;
}) {
  const addItem = useCart((s) => s.addItem);
  const itensNaSacola = useCart((s) => s.items);
  const openCart = useCartUi((s) => s.openCart);

  // Cor inicial: comprável E com foto — nessa ordem. O card da vitrine abre na
  // 1ª cor COM FOTO (ele não conhece estoque), então preferir "comprável com
  // foto" faz as duas telas concordarem sempre que essa cor tem saldo, sem
  // precisar carregar estoque na listagem. Se nada for comprável, ainda assim
  // mostramos uma cor com foto em vez de cair num placeholder.
  const firstBuyableColor =
    colors.find((c) => colorBuyable(c, price) && c.gallery.length > 0) ??
    colors.find((c) => colorBuyable(c, price)) ??
    colors.find((c) => c.gallery.length > 0) ??
    colors[0] ??
    null;

  const [selectedColorId, setSelectedColorId] = useState<string | null>(
    firstBuyableColor?.id ?? null,
  );
  const [selectedSize, setSelectedSize] = useState<string | null>(
    autoSize(firstBuyableColor ?? undefined, price),
  );
  const [imageIndex, setImageIndex] = useState(0);
  const [added, setAdded] = useState(false);
  const [qtyText, setQtyText] = useState("1");

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
        image: color.gallery[0] ?? null,
      },
      qty,
    );
    setQtyText("1");
    setAdded(true);
    // Abre a GAVETA em vez de só piscar um "✓": o cliente vê o item na sacola
    // e decide na hora entre continuar e fechar — padrão das lojas modernas,
    // e no celular evita a dúvida de "será que foi?".
    openCart();
    window.setTimeout(() => setAdded(false), 2500);
  }

  const hasPromo = promoPrice != null && basePrice != null;
  const off =
    hasPromo && (basePrice as number) > 0 && price != null
      ? Math.round((1 - price / (basePrice as number)) * 100)
      : null;
  const parcelas = installmentsFor(price);

  const selectedEsgotado =
    !!selectedVariant && !variantBuyable(selectedVariant, price);

  /**
   * Teto da quantidade: o estoque da variante MENOS o que já está na sacola.
   *
   * Sem isso dava para pedir 4 de uma peça com estoque 1 — e a tela ainda
   * mostrava "Última unidade!" logo abaixo, se contradizendo. O cliente só
   * descobriria na recusa do checkout, que é o pior momento para ouvir não.
   * Descontar a sacola importa porque somar 1 duas vezes chega ao mesmo lugar.
   *
   * É um limite de INTERFACE, não a garantia: o estoque muda entre carregar a
   * página e clicar (ainda mais com reserva), e quem decide continua sendo o
   * servidor, dentro do UPDATE.
   */
  const jaNaSacola =
    itensNaSacola.find((i) => i.variantId === selectedVariant?.id)?.qty ?? 0;
  const maxQty = selectedVariant
    ? Math.max(0, selectedVariant.qty - jaNaSacola)
    : 0;
  const qty = Math.min(
    Math.max(1, parseInt(qtyText, 10) || 1),
    Math.max(1, maxQty),
  );
  const noTeto = maxQty > 0 && qty >= maxQty;
  const addLabel = added
    ? "Adicionado à sacola ✓"
    : !anyBuyable
      ? "Indisponível"
      : canAdd
        ? "Adicionar à sacola"
        : selectedEsgotado
          ? selectedVariant?.reservado
            ? "Reservado no momento"
            : "Esgotado"
          : hasSizes
            ? "Selecione um tamanho"
            : "Selecione uma cor";

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
        <div className="mt-2 flex items-start justify-between gap-4">
          <h1 className="font-serif text-4xl font-semibold tracking-tight">
            {name}
          </h1>
          <WishlistHeart
            productId={productId}
            initialFavorite={isFavorite}
            isLogged={isLogged}
            backTo={`/produtos/${slug}`}
            className="mt-1 shrink-0"
          />
        </div>

        {price != null && (
          <div className="mt-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-2xl">{formatBRL(price)}</span>
              {hasPromo && (
                <span className="text-base text-muted line-through">
                  {formatBRL(basePrice as number)}
                </span>
              )}
              {off != null && off >= 5 && (
                <span className="rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background">
                  −{off}%
                </span>
              )}
            </div>
            {parcelas && (
              <p className="mt-1 text-sm text-muted">
                ou em até {parcelas.count}x de {formatBRL(parcelas.value)} no
                cartão
              </p>
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
              Cor{color ? `: ${displayColor(color.name)}` : ""}
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
                    title={displayColor(c.name)}
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
                    {displayColor(c.name)}
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
                const esgotado = !variantBuyable(v, price);
                const isSelected = v.size === selectedSize;
                return (
                  <button
                    key={v.id}
                    type="button"
                    // Esgotado continua CLICÁVEL: selecionar é o caminho para o
                    // "avise-me quando chegar" — botão desabilitado mataria isso.
                    onClick={() => setSelectedSize(v.size)}
                    aria-label={`Tamanho ${v.size}${esgotado ? " — esgotado" : ""}`}
                    className={`flex h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm transition-colors ${
                      isSelected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground"
                    } ${esgotado ? "opacity-40 line-through" : ""}`}
                  >
                    {v.size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {measurement && (
          <div className="mt-6">
            <MeasurementTable chart={measurement} />
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
                onBlur={() => setQtyText(String(qty))}
                className="h-11 w-14 border-x border-border bg-transparent text-center text-sm outline-none"
              />
              <button
                type="button"
                aria-label="Aumentar quantidade"
                onClick={() => setQtyText(String(Math.min(qty + 1, maxQty)))}
                disabled={noTeto}
                className="flex h-11 w-11 items-center justify-center text-lg text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
            </div>
            {noTeto && maxQty > 0 && (
              <p className="mt-2 text-xs text-muted">
                {jaNaSacola > 0
                  ? `Você já tem ${jaNaSacola} na sacola — é tudo o que temos desta peça.`
                  : `Máximo disponível: ${maxQty}.`}
              </p>
            )}
          </div>
        )}

        {/* Urgência HONESTA: o número vem do estoque real da variante. */}
        {canAdd && selectedVariant && selectedVariant.qty <= 3 && (
          <p className="mt-4 text-sm font-medium text-amber-600 dark:text-amber-500">
            {selectedVariant.qty === 1
              ? "Última unidade!"
              : `Últimas ${selectedVariant.qty} unidades`}
          </p>
        )}

        {/* Saldo zero por reserva não é fim de estoque: alguém está pagando
          agora e a peça volta em minutos se o pagamento não sair. Dizer
          "esgotado" aqui seria mentira, e mentira que faz o cliente desistir
          de uma peça que talvez ainda seja dele. */}
        {selectedEsgotado && selectedVariant?.reservado && (
          <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            Última peça <strong>em processo de compra</strong> por outro
            cliente. Se o pagamento não for concluído, ela volta a ficar
            disponível em alguns minutos — vale tentar de novo mais tarde.
          </p>
        )}

        {(selectedEsgotado || !anyBuyable) &&
          (selectedVariant || !hasSizes ? (
            <BackInStockForm
              variantId={selectedVariant?.id ?? color?.variants[0]?.id ?? null}
            />
          ) : (
            <p className="mt-4 text-sm text-muted">
              Selecione o tamanho esgotado para pedir o aviso de reposição.
            </p>
          ))}

        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="mt-8 hidden h-12 items-center justify-center rounded-full bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40 md:inline-flex"
        >
          {addLabel}
        </button>

        {description && (
          <div className="mt-10 border-t border-border pt-6">
            {/* `whitespace-pre-line` preserva as quebras digitadas no admin: o
                campo é um textarea simples, e sem isto a descrição em tópicos
                vira um parágrafo corrido. */}
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
              {description}
            </p>
          </div>
        )}
      </div>

      {/* Barra de compra do celular: STICKY no fim da grade do produto —
          gruda no rodapé da tela enquanto o produto está em vista e sai de
          cena junto com ele (não cobre relacionados nem o rodapé do site,
          que era o problema da versão `fixed`). */}
      <div className="sticky bottom-0 z-30 -mx-6 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="flex items-center gap-4 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="min-w-0">
            {price != null && (
              <p className="text-base font-medium leading-tight">
                {formatBRL(price)}
              </p>
            )}
            {parcelas && (
              <p className="truncate text-[0.7rem] text-muted">
                até {parcelas.count}x de {formatBRL(parcelas.value)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className="ml-auto inline-flex h-11 max-w-64 flex-1 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {addLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Avise-me quando chegar" — aparece na variante esgotada. O disparo do
 * e-mail acontece quando o admin repõe o estoque. */
function BackInStockForm({ variantId }: { variantId: string | null }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );
  const [msg, setMsg] = useState<string | null>(null);
  if (!variantId) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "busy") return;
    setState("busy");
    setMsg(null);
    try {
      const res = await createStockAlertAction(variantId as string, email);
      if (res.ok) {
        setState("done");
      } else {
        setState("error");
        setMsg(res.error ?? "Não foi possível salvar.");
      }
    } catch {
      setState("error");
      setMsg("Não foi possível salvar. Tente de novo.");
    }
  }

  if (state === "done")
    return (
      <p className="mt-4 rounded-md border border-border px-4 py-3 text-sm">
        Pronto! Você será avisado por e-mail quando este item voltar. 📬
      </p>
    );

  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-md border border-border p-4"
    >
      <p className="text-sm font-medium">Avise-me quando chegar</p>
      <p className="mt-0.5 text-xs text-muted">
        Deixe seu e-mail e avisamos assim que este tamanho voltar.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          aria-label="E-mail para aviso de estoque"
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:border-foreground"
        />
        <button
          type="submit"
          disabled={state === "busy"}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-border px-4 text-sm font-medium transition-colors hover:border-foreground disabled:opacity-50"
        >
          {state === "busy" ? "Salvando…" : "Avisar"}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-red-600">{msg}</p>}
    </form>
  );
}
