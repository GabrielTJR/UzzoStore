"use client";

import { create } from "zustand";

/**
 * Estado de UI da sacola (gaveta aberta/fechada). Separado do `cart-store`
 * de propósito: aquele é PERSISTIDO em localStorage, e persistir `open` faria
 * a gaveta reabrir sozinha ao voltar ao site.
 */
type CartUiState = {
  open: boolean;
  openCart: () => void;
  closeCart: () => void;
};

export const useCartUi = create<CartUiState>()((set) => ({
  open: false,
  openCart: () => set({ open: true }),
  closeCart: () => set({ open: false }),
}));
