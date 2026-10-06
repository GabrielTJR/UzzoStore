"use client";

import { deleteCouponAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/submit-button";

/**
 * Excluir pede confirmação — antes era um clique só. Cupom que já vendeu
 * merece o aviso de que pausar resolve sem perder o histórico na tela.
 */
export function DeleteCouponButton({
  code,
  usos,
  ativo,
}: {
  code: string;
  usos: number;
  ativo: boolean;
}) {
  return (
    <form
      action={deleteCouponAction}
      onSubmit={(e) => {
        const msg =
          usos > 0
            ? `O cupom ${code} já foi usado ${usos} ${usos === 1 ? "vez" : "vezes"}. Excluir tira ele desta lista para sempre${ativo ? " — para só parar de aceitar, use Pausar" : ""}. Excluir mesmo assim?`
            : `Excluir o cupom ${code}?`;
        if (!window.confirm(msg)) e.preventDefault();
      }}
    >
      <input type="hidden" name="code" value={code} />
      <SubmitButton
        pendingText="Excluindo…"
        className="text-sm text-red-600 underline-offset-4 hover:underline dark:text-red-400"
      >
        Excluir
      </SubmitButton>
    </form>
  );
}
