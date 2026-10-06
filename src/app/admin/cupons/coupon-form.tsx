"use client";

import { useActionState } from "react";
import { createCouponAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/submit-button";
import { useToast } from "@/components/toast";
import { useEffect, useRef } from "react";

const field =
  "h-11 w-full rounded-xs border border-border bg-transparent px-3 text-sm outline-none focus:border-foreground";
const label = "block text-sm font-medium";

export function CouponForm() {
  const [state, formAction] = useActionState(createCouponAction, null);
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      showToast("Cupom criado");
      formRef.current?.reset();
    } else if (state.error) showToast(state.error, "error");
  }, [state, showToast]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-2 gap-4">
      <div className="col-span-2 space-y-1.5">
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
      <label className="col-span-2 flex items-center gap-2.5 text-sm">
        <input type="checkbox" name="umaPorCliente" className="h-4 w-4" />
        Uma vez por cliente (exige login para usar)
      </label>
      <p className="col-span-2 -mt-1 text-xs text-muted">
        Deixe em branco o que não tiver limite. O cupom nasce ativo.
      </p>
      <div className="col-span-2">
        <SubmitButton className="h-11 w-full rounded-xs bg-foreground text-sm font-semibold text-background hover:opacity-90">
          Criar cupom
        </SubmitButton>
      </div>
    </form>
  );
}
