"use client";

import { useState, useTransition } from "react";
import { formatBRL } from "@/lib/format";
import { IconExternal } from "@/components/icons";
import {
  atualizarEtiquetaAction,
  comprarEtiquetaAction,
  prepararEtiquetaAction,
} from "./label-actions";

/**
 * Etiqueta do Melhor Envio no pedido. Dois cliques de propósito: o primeiro
 * (com a chave da NF-e) mostra o preço REAL; só o segundo cobra da carteira.
 */
export function LabelPanel({
  orderId,
  paid,
  melhorenvioId,
  labelUrl,
  trackingCode,
  temServico,
}: {
  orderId: string;
  paid: boolean;
  melhorenvioId: string | null;
  labelUrl: string | null;
  trackingCode: string | null;
  temServico: boolean;
}) {
  const [chave, setChave] = useState("");
  const [preco, setPreco] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, start] = useTransition();

  const botao =
    "h-9 rounded-xs bg-foreground px-4 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-60";
  const secundario =
    "h-9 rounded-xs border border-border px-4 text-xs font-medium hover:border-foreground disabled:opacity-60";

  function rodar(fn: () => Promise<{ ok: boolean; error?: string; price?: number }>, aoDarCerto?: (price?: number) => void) {
    start(async () => {
      setErro(null);
      const r = await fn();
      if (!r.ok) setErro(r.error ?? "Não deu certo.");
      else aoDarCerto?.(r.price);
    });
  }

  const pronta = !!labelUrl?.startsWith("https://");
  const pagaSemPdf = !!labelUrl && !pronta;
  // Preparada nesta tela OU numa visita anterior (está no carrinho deles).
  const preparada = preco != null || (!!melhorenvioId && !labelUrl);

  return (
    <div className="mt-4 rounded-sm border border-border p-3">
      <p className="text-xs font-semibold">Etiqueta do Melhor Envio</p>

      {pronta ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <a
            href={labelUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className={`${botao} inline-flex items-center gap-1.5`}
          >
            <IconExternal size={14} />
            Imprimir etiqueta
          </a>
          {!trackingCode && (
            <button
              type="button"
              disabled={pendente}
              onClick={() => rodar(() => atualizarEtiquetaAction(orderId))}
              className={secundario}
            >
              {pendente ? "Buscando…" : "Buscar rastreio"}
            </button>
          )}
        </div>
      ) : pagaSemPdf ? (
        <div className="mt-2">
          <p className="text-xs text-muted">
            Etiqueta paga, mas o PDF ainda não saiu.
          </p>
          <button
            type="button"
            disabled={pendente}
            onClick={() => rodar(() => atualizarEtiquetaAction(orderId))}
            className={`${botao} mt-2`}
          >
            {pendente ? "Gerando…" : "Gerar de novo"}
          </button>
        </div>
      ) : !paid ? (
        <p className="mt-1 text-xs text-muted">
          Disponível depois que o pagamento for confirmado.
        </p>
      ) : !temServico ? (
        <p className="mt-1 text-xs text-muted">
          Este pedido não guardou o serviço de frete escolhido. Compre a
          etiqueta pelo painel do Melhor Envio.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          <label className="block text-xs text-muted" htmlFor={`nfe-${orderId}`}>
            Chave da NF-e (44 números, do DANFE emitido no Microvix)
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={`nfe-${orderId}`}
              value={chave}
              onChange={(e) => {
                setChave(e.target.value);
                setPreco(null);
              }}
              inputMode="numeric"
              placeholder="0000 0000 0000 …"
              className="h-9 min-w-0 flex-1 rounded-xs border border-border bg-transparent px-3 font-mono text-xs outline-none focus:border-foreground"
            />
            <button
              type="button"
              disabled={pendente || chave.replace(/\D/g, "").length !== 44}
              onClick={() =>
                rodar(
                  () => prepararEtiquetaAction(orderId, chave),
                  (p) => setPreco(p ?? 0),
                )
              }
              className={secundario}
            >
              {pendente && preco == null ? "Consultando…" : "Ver preço"}
            </button>
          </div>
          {preparada && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={pendente}
                onClick={() => rodar(() => comprarEtiquetaAction(orderId))}
                className={botao}
              >
                {pendente
                  ? "Comprando…"
                  : preco
                    ? `Comprar por ${formatBRL(preco)}`
                    : "Comprar etiqueta"}
              </button>
              <span className="text-xs text-muted">
                Sai do saldo da carteira do Melhor Envio.
              </span>
            </div>
          )}
        </div>
      )}

      {erro && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
    </div>
  );
}
