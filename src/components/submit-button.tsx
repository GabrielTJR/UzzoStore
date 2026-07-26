"use client";

import { useFormStatus } from "react-dom";

/**
 * Botão de submit que reflete o estado de envio do formulário pai
 * (useFormStatus). Mostra texto de "carregando" e fica desabilitado enquanto
 * a server action roda — funciona tanto em forms simples quanto com useActionState.
 */
export function SubmitButton({
  children,
  pendingText = "Salvando…",
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  pendingText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={`transition-opacity disabled:opacity-50 ${
        pending ? "opacity-70" : ""
      } ${className}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
