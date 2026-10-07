"use client";

import { useState, useTransition } from "react";
import { formatBRL } from "@/lib/format";
import { IconExternal } from "@/components/icons";
import { updateFulfillmentAction } from "../actions";
import {
  atualizarEtiquetaAction,
  cancelarEtiquetaAction,
  comprarEtiquetaAction,
  prepararEtiquetaAction,
} from "./label-actions";

/**
 * Etiqueta do Melhor Envio no pedido. Dois cliques de propósito: o primeiro
 * (com a chave da NF-e) mostra o preço REAL; só o segundo cobra da carteira.
 *
 * Comprada, o próximo passo fica à mão: "Marcar como enviado" (avisa o
 * cliente por e-mail, com o rastreio que estiver gravado) — eram dois passos
 * separados e esquecer o segundo deixava o cliente sem aviso. E, até o envio,
 * "Cancelar etiqueta" devolve o valor à carteira do Melhor Envio.
 */
export function LabelPanel({
  orderId,
  paid,
  melhorenvioId,
  labelUrl,
  trackingCode,
  temServico,
  fulfillmentStatus,
}: {
  orderId: string;
  paid: boolean;
  melhorenvioId: string | null;
  labelUrl: string | null;
  trackingCode: string | null;
  temServico: boolean;
  fulfillmentStatus: string;
}) {
  const [chave, setChave] = useState("");
  const [preco, setPreco] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, start] = useTransition();

  const botao =
    "h-9 rounded-xs bg-foreground px-4 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-60";
  const secundario =
    "h-9 rounded-xs border border-border px-4 text-xs font-medium hover:border-foreground disabled:opacity-60";

  function rodar(
    fn: () => Promise<{ ok: boolean; error?: string; price?: number }>,
    aoDarCerto?: (price?: number) => void,
  ) {
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
  const aEnviar =
    fulfillmentStatus === "pending" || fulfillmentStatus === "preparing";

  function cancelar() {
    if (
      !window.confirm(
        "Cancelar esta etiqueta? O valor volta para a carteira do Melhor Envio. Só funciona se o pacote ainda não foi postado.",
      )
    )
      return;
    rodar(() => cancelarEtiquetaAction(orderId));
  }

  const linkCancelar = aEnviar && (
    <button
      type="button"
      disabled={pendente}
      onClick={cancelar}
      className="text-xs text-red-600 underline-offset-4 hover:underline disabled:opacity-60 dark:text-red-400"
    >
      Cancelar etiqueta
    </button>
  );

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
          {aEnviar && (
            <form action={updateFulfillmentAction} className="contents">
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="status" value="shipped" />
              <button type="submit" disabled={pendente} className={secundario}>
                Marcar como enviado
              </button>
            </form>
          )}
          {linkCancelar}
          {aEnviar && (
            <p className="basis-full text-xs text-muted">
              {trackingCode
                ? `Ao marcar como enviado, o cliente recebe o e-mail com o rastreio ${trackingCode}.`
                : "Ao marcar como enviado, o cliente recebe o e-mail — ainda sem código (a transportadora informa depois da postagem; use “Buscar rastreio” antes, se quiser)."}
            </p>
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
          <div className="mt-2">{linkCancelar}</div>
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
          <label
            className="block text-xs text-muted"
            htmlFor={`nfe-${orderId}`}
          >
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
