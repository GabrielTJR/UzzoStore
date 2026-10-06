import { create } from "zustand";
import { persist } from "zustand/middleware";
import { onlyDigits } from "@/lib/customer-fields";

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
  /** Saldo da variante quando foi adicionada: teto do "+" na gaveta e na
   * sacola (o mesmo da página do produto). É limite de INTERFACE — o saldo
   * muda, e quem decide continua sendo o servidor no checkout. Opcional:
   * sacolas antigas não o têm (aí o "+" fica livre, como antes). */
  maxQty?: number;
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
  /**
   * Último CEP que o cliente COTOU (8 dígitos), na sacola ou na página do
   * produto. Serve só para pré-preencher o endereço do checkout — quem já
   * digitou o CEP uma vez não deveria digitar de novo. Não decide frete: o
   * checkout cota pelo endereço salvo. Diferente de `shipping`, sobrevive a
   * mudanças na sacola (o CEP de quem compra não muda porque a sacola mudou).
   */
  cep: string | null;
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  removeItem: (variantId: string) => void;
  setQty: (variantId: string, qty: number) => void;
  /** Troca o preço guardado pelo que o SERVIDOR leu (preço mudou com a peça
   * já na sacola). Só exibição: quem cobra continua relendo no servidor. */
  setPrices: (precos: Record<string, number>) => void;
  setCoupon: (code: string | null) => void;
  setShipping: (s: CartShipping | null) => void;
  /** Guarda só CEP completo; incompleto é ignorado (não apaga o que já havia). */
  setCep: (cep: string | null) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      coupon: null,
      shipping: null,
      cep: null,
      addItem: (item, qty = 1) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.variantId === item.variantId,
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId
                  ? {
                      ...i,
                      qty: i.qty + qty,
                      // saldo mais recente que a página do produto viu
                      ...(item.maxQty != null ? { maxQty: item.maxQty } : {}),
                    }
                  : i,
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
      setPrices: (precos) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.variantId in precos ? { ...i, price: precos[i.variantId] } : i,
          ),
        })),
      setCoupon: (code) => set({ coupon: code }),
      setShipping: (s) => set({ shipping: s }),
      setCep: (cep) => {
        if (cep == null) return set({ cep: null });
        const d = onlyDigits(cep);
        if (d.length === 8) set({ cep: d });
      },
      clear: () => set({ items: [], coupon: null, shipping: null, cep: null }),
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
