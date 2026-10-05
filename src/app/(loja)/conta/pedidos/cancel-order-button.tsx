"use client";

import { cancelOrderAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";

export function CancelOrderButton({
  orderId,
  number,
}: {
  orderId: string;
  number: number;
}) {
  return (
    <form
      action={cancelOrderAction}
      onSubmit={(e) => {
        if (!window.confirm(`Cancelar o pedido nº ${number}?`))
          e.preventDefault();
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <SubmitButton
        pendingText="Cancelando…"
        className="text-sm text-red-600 underline-offset-4 hover:underline dark:text-red-400"
      >
        Cancelar pedido
      </SubmitButton>
    </form>
  );
}
