"use client";

import { useActionState, useEffect, useRef } from "react";
import { addPhotosAction, type ActionResult } from "./actions";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";

export function AddPhotosForm({ productId }: { productId: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    addPhotosAction,
    null,
  );
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      showToast("Fotos enviadas");
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="productId" value={productId} />
      <input
        type="file"
        name="images"
        accept="image/*"
        multiple
        required
        className="text-sm text-muted file:mr-3 file:rounded-full file:border file:border-border file:bg-transparent file:px-4 file:py-2 file:text-sm file:text-foreground"
      />
      <SubmitButton
        pendingText="Enviando…"
        className="h-10 rounded-full border border-border px-5 text-sm font-medium hover:border-foreground"
      >
        Enviar fotos
      </SubmitButton>
      {state?.error && (
        <span className="text-sm text-red-600">{state.error}</span>
      )}
    </form>
  );
}
