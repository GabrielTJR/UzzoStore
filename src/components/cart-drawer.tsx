"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart, cartSubtotal } from "@/lib/cart-store";
import { useCartUi } from "@/lib/cart-ui";
import { formatBRL } from "@/lib/format";
import { installmentsFor } from "@/lib/installments";
import { FreeShippingBar } from "@/components/free-shipping-bar";

/**
 * Gaveta lateral da sacola. Abre ao adicionar um item (sem tirar o cliente da
 * página — no celular, trocar de página no meio da escolha é onde se perde a
 * venda) e pelo ícone do header. 100% client-side (Zustand), zero consulta.
 *
 * A página /sacola continua existindo: é onde vive o fluxo completo
 * (WhatsApp/pagamento). A gaveta é o atalho; os botões levam para lá.
 */
export function CartDrawer({
  shippingEnabled = false,
}: {
  shippingEnabled?: boolean;
}) {
  const { open, closeCart } = useCartUi();
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const removeItem = useCart((s) => s.removeItem);
  const subtotal = cartSubtotal(items);
  const parcelas = installmentsFor(subtotal);

  // Trava o scroll da página enquanto a gaveta está aberta (senão, no celular,
  // o dedo rola a loja atrás da gaveta).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Gestão de foco de modal: foca a gaveta ao abrir, prende o Tab dentro dela
  // e DEVOLVE o foco a quem abriu ao fechar — sem isso, quem navega por
  // teclado/leitor de tela "cai" atrás do overlay e se perde.
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => before?.focus();
  }, [open]);

  // Esc fecha (padrão de modal) e Tab circula só entre os focáveis da gaveta.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeCart();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeCart]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Sacola"
    >
      {/* Fundo escurecido: clicar fora fecha */}
      <button
        type="button"
        aria-label="Fechar sacola"
        onClick={closeCart}
        className="absolute inset-0 bg-black/40 animate-fade-in"
      />

      <aside
        ref={panelRef}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-background shadow-2xl outline-none animate-drawer-in"
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-medium">
            Sua sacola
            {items.length > 0 && (
              <span className="ml-2 text-sm text-muted">
                ({items.reduce((n, i) => n + i.qty, 0)}{" "}
                {items.reduce((n, i) => n + i.qty, 0) === 1 ? "item" : "itens"})
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Fechar"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:text-foreground"
          >
            ✕
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-muted">Sua sacola está vazia.</p>
            <Link
              href="/produtos"
              onClick={closeCart}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border px-6 text-sm font-medium transition-colors hover:border-foreground"
            >
              Ver produtos
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-border overflow-y-auto px-5">
              {items.map((item) => (
                <li key={item.variantId} className="flex gap-3 py-4">
                  <Link
                    href={`/produtos/${item.productSlug}`}
                    onClick={closeCart}
                    className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-border/30"
                  >
                    {item.image && (
                      <Image
                        src={item.image}
                        alt={item.productName}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={`/produtos/${item.productSlug}`}
                      onClick={closeCart}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {item.productName}
                    </Link>
                    {(item.color || item.size) && (
                      <p className="mt-0.5 text-xs text-muted">
                        {[item.color, item.size].filter(Boolean).join(" · ")}
                      </p>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center rounded-md border border-border">
                        <button
                          type="button"
                          aria-label={`Diminuir quantidade de ${item.productName}`}
                          onClick={() => setQty(item.variantId, item.qty - 1)}
                          className="flex h-10 w-10 items-center justify-center text-muted transition-colors hover:text-foreground"
                        >
                          −
                        </button>
                        <span className="w-7 text-center text-xs">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          aria-label={`Aumentar quantidade de ${item.productName}`}
                          onClick={() => setQty(item.variantId, item.qty + 1)}
                          className="flex h-10 w-10 items-center justify-center text-muted transition-colors hover:text-foreground"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-medium">
                        {formatBRL(item.price * item.qty)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label={`Remover ${item.productName} da sacola`}
                    onClick={() => removeItem(item.variantId)}
                    className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center self-start text-muted transition-colors hover:text-foreground"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>

            <footer className="space-y-3 border-t border-border p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              {shippingEnabled && <FreeShippingBar subtotal={subtotal} />}
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted">Subtotal</span>
                <div className="text-right">
                  <p className="text-lg font-medium">{formatBRL(subtotal)}</p>
                  {parcelas && (
                    <p className="text-xs text-muted">
                      em até {parcelas.count}x de {formatBRL(parcelas.value)}
                      {parcelas.semJuros ? " sem juros" : ""}
                    </p>
                  )}
                </div>
              </div>
              <Link
                href="/sacola"
                onClick={closeCart}
                className="flex h-12 w-full items-center justify-center rounded-full bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                Finalizar compra
              </Link>
              <button
                type="button"
                onClick={closeCart}
                className="flex h-11 w-full items-center justify-center rounded-full border border-border text-sm font-medium transition-colors hover:border-foreground"
              >
                Continuar comprando
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
