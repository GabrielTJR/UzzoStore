"use client";

import { useState } from "react";

/**
 * Copia um texto (o código de rastreio, por exemplo) e confirma na hora.
 * Sem a API de área de transferência (navegador antigo, página sem HTTPS), o
 * texto continua selecionável na tela — o botão só não aparece.
 */
export function CopyButton({
  text,
  label = "Copiar",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  if (typeof navigator !== "undefined" && !navigator.clipboard) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopiado(true);
          window.setTimeout(() => setCopiado(false), 2000);
        } catch {
          /* sem permissão: o texto segue selecionável */
        }
      }}
      aria-live="polite"
      className={`inline-flex min-h-9 items-center rounded-xs border border-border px-3 text-xs font-semibold hover:border-foreground ${className}`}
    >
      {copiado ? "Copiado!" : label}
    </button>
  );
}
