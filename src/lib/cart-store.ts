import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  variantId: string;
  productSlug: string;
  productName: string;
  color: string | null;
  size: string | null;
  price: number;
  qty: number;
  /** 1ª foto da cor no momento do add — miniatura da gaveta/sacola. Opcional:
   * sacolas persistidas antes deste campo não o têm. */
  image?: string | null;
};

/** Frete escolhido na sacola (preço é EXIBIÇÃO; o servidor recota na hora do
 * pedido — localStorage não é fonte de verdade para dinheiro). */
export type CartShipping = {
  cep: string;
  serviceId: number;
  name: string;
  price: number;
};

type CartState = {
  items: CartItem[];
  coupon: string | null;
  shipping: CartShipping | null;
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  removeItem: (variantId: string) => void;
  setQty: (variantId: string, qty: number) => void;
  setCoupon: (code: string | null) => void;
  setShipping: (s: CartShipping | null) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      coupon: null,
      shipping: null,
      addItem: (item, qty = 1) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.variantId === item.variantId,
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId ? { ...i, qty: i.qty + qty } : i,
              ),
              shipping: null,
            };
          }
          return { items: [...state.items, { ...item, qty }], shipping: null };
        }),
      removeItem: (variantId) =>
        set((state) => ({
          items: state.items.filter((i) => i.variantId !== variantId),
          shipping: null,
        })),
      setQty: (variantId, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((i) => i.variantId !== variantId)
              : state.items.map((i) =>
                  i.variantId === variantId ? { ...i, qty } : i,
                ),
          // Mudou a sacola, mudou o peso: a cotação antiga não vale mais.
          shipping: null,
        })),
      setCoupon: (code) => set({ coupon: code }),
      setShipping: (s) => set({ shipping: s }),
      clear: () => set({ items: [], coupon: null, shipping: null }),
    }),
    { name: "uzzo-cart" },
  ),
);

export function cartCount(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.qty, 0);
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.price * i.qty, 0);
}
