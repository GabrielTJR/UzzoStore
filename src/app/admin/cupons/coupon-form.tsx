"use client";

import { useActionState } from "react";
import { createCouponAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/submit-button";
import { useToast } from "@/components/toast";
import { useEffect } from "react";

const field =
  "h-11 w-full rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:border-foreground";
const label = "block text-sm font-medium";

export function CouponForm() {
  const [state, formAction] = useActionState(createCouponAction, null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!state) return;
    if (state.ok) showToast("Cupom criado ✓");
    else if (state.error) showToast(state.error, "error");
  }, [state, showToast]);

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-lg border border-border p-5 sm:grid-cols-2 lg:grid-cols-5"
    >
      <div className="space-y-1.5">
        <label className={label} htmlFor="code">
          Código *
        </label>
        <input
          id="code"
          name="code"
          required
          placeholder="BEMVINDO10"
          className={`${field} uppercase`}
        />
      </div>
      <div className="space-y-1.5">
        <label className={label} htmlFor="percent">
          Desconto (%) *
        </label>
        <input
          id="percent"
          name="percent"
          required
          inputMode="decimal"
          placeholder="10"
          className={field}
        />
      </div>
      <div className="space-y-1.5">
        <label className={label} htmlFor="minSubtotal">
          Pedido mínimo (R$)
        </label>
        <input
          id="minSubtotal"
          name="minSubtotal"
          inputMode="decimal"
          placeholder="0"
          className={field}
        />
      </div>
      <div className="space-y-1.5">
        <label className={label} htmlFor="maxUses">
          Limite de usos
        </label>
        <input
          id="maxUses"
          name="maxUses"
          inputMode="numeric"
          placeholder="ilimitado"
          className={field}
        />
      </div>
      <div className="space-y-1.5">
        <label className={label} htmlFor="expiresAt">
          Válido até
        </label>
        <input id="expiresAt" name="expiresAt" type="date" className={field} />
      </div>
      <div className="sm:col-span-2 lg:col-span-5">
        <SubmitButton>Criar cupom</SubmitButton>
      </div>
    </form>
  );
}
