"use client";

import { deleteProductAction } from "./actions";
import { SubmitButton } from "@/components/submit-button";

export function DeleteProductButton({ productId }: { productId: string }) {
  return (
    <form
      action={deleteProductAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Excluir este produto? Esta ação não pode ser desfeita.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="productId" value={productId} />
      <SubmitButton
        pendingText="Excluindo…"
        className="text-sm text-red-600 underline-offset-4 hover:underline dark:text-red-400"
      >
        Excluir produto
      </SubmitButton>
    </form>
  );
}
