"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart-store";

/** Esvazia a sacola depois que o pagamento foi confirmado. */
export function ClearCart() {
  const clear = useCart((s) => s.clear);
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
