"use client";

import { removeAdminAction } from "./actions";
import { SubmitButton } from "@/components/submit-button";

export function RemoveAdminButton({ userId }: { userId: string }) {
  return (
    <form
      action={removeAdminAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Remover esta pessoa da equipe? Ela perde o acesso ao painel na hora.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <SubmitButton
        pendingText="Removendo…"
        className="text-sm text-red-600 underline-offset-4 hover:underline dark:text-red-400"
      >
        Remover
      </SubmitButton>
    </form>
  );
}
