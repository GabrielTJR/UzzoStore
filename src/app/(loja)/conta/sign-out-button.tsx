"use client";

import { useTransition } from "react";
import { IconLogout } from "@/components/icons";
import { signOutCustomerAction } from "./actions";

/**
 * "Sair" da área do cliente. Mostra "Saindo…" na hora e termina com RECARGA
 * COMPLETA para a home: o "quem é" da vitrine (`lib/viewer.ts`) mora no
 * navegador e só é relido ao carregar a página — uma navegação interna
 * deixava o cabeçalho dizendo "Minha conta" depois de sair, e o clique
 * parecia não ter feito nada.
 */
export function SignOutButton({ className = "" }: { className?: string }) {
  const [saindo, start] = useTransition();
  return (
    <div className={className}>
      <button
        type="button"
        disabled={saindo}
        aria-busy={saindo || undefined}
        onClick={() =>
          start(async () => {
            await signOutCustomerAction();
            window.location.assign("/");
          })
        }
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted transition-colors hover:text-foreground disabled:opacity-60 md:px-3"
      >
        <IconLogout size={18} />
        {saindo ? "Saindo…" : "Sair"}
      </button>
    </div>
  );
}
