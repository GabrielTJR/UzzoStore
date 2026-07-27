"use client";

import { removeProductColorAction } from "./actions";
import { SubmitButton } from "@/components/submit-button";

export function RemoveColorButton({
  productId,
  productColorId,
  colorName,
}: {
  productId: string;
  productColorId: string;
  colorName: string;
}) {
  return (
    <form
      action={removeProductColorAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Excluir a cor "${colorName}"? Isso remove as fotos, tamanhos e estoque dessa cor.`,
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="productColorId" value={productColorId} />
      <SubmitButton
        pendingText="Excluindo…"
        className="text-xs text-red-600 underline-offset-4 hover:underline dark:text-red-400"
      >
        Excluir cor
      </SubmitButton>
    </form>
  );
}
