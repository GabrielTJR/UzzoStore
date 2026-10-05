"use client";

import { useEffect, useState } from "react";
import { payPendingOrderAction } from "../actions";
import { temFolgaParaPagar } from "./pode-pagar";

/** Minutos inteiros que faltam (arredondado para baixo: nunca promete mais). */
function minutosRestantes(expiresAt: string, agora: number): number {
  return Math.max(0, Math.floor((Date.parse(expiresAt) - agora) / 60_000));
}

/**
 * "Pagar agora" de um pedido online pendente, com o tempo que falta para a
 * reserva acabar. Some quando resta menos que a folga (`REUSO_MIN_RESTANTE_MIN`):
 * pagar em cima da hora faria o dinheiro chegar depois de a peça voltar à
 * vitrine. O relógio é só AVISO: quem decide é a action, no servidor.
 *
 * Saindo para a InfinitePay o botão fica travado (dois toques = duas idas ao
 * servidor); o `pageshow` o devolve se o cliente voltar pelo "voltar".
 */
export function PayOrderButton({
  orderId,
  expiresAt,
}: {
  orderId: string;
  expiresAt: string;
}) {
  // `null` até montar: o servidor não sabe a hora do aparelho, e renderizar o
  // número lá daria divergência na hidratação.
  const [agora, setAgora] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setAgora(Date.now());
    tick();
    const t = window.setInterval(tick, 15_000);
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy(false);
      tick();
    };
    window.addEventListener("pageshow", onShow);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("pageshow", onShow);
    };
  }, [expiresAt]);

  // Antes de montar não se sabe a hora: nada aparece (sem botão que some).
  if (agora == null) return null;
  if (!temFolgaParaPagar(expiresAt, agora))
    return (
      <p className="text-sm text-muted">
        O prazo deste pedido acabou. Monte a sacola de novo para pagar.
      </p>
    );
  const restam = minutosRestantes(expiresAt, agora);

  async function pagar() {
    if (busy) return;
    setBusy(true);
    setError(null);
    let saiu = false;
    try {
      const res = await payPendingOrderAction(orderId);
      if (res.ok && res.url) {
        saiu = true;
        window.location.assign(res.url);
        return;
      }
      setError(res.error ?? "Não foi possível abrir o pagamento.");
    } catch {
      setError("Não foi possível abrir o pagamento.");
    } finally {
      if (!saiu) setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={pagar}
          disabled={busy}
          aria-busy={busy || undefined}
          className="inline-flex h-11 items-center justify-center rounded-xs bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Abrindo pagamento…" : "Pagar agora"}
        </button>
        <span className="text-sm text-muted">
          {`Reservado por mais ${restam} minutos`}
        </span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
