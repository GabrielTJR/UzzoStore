"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ShippingOptions } from "@/components/shipping-options";
import type { QuoteResult } from "@/app/(loja)/sacola/shipping-actions";
import type { ShippingOption } from "@/lib/shipping";
import type { CustomerAddress } from "@/lib/customer";
import { AddressQuickForm } from "./address-quick-form";

/**
 * Passo 2: receber em casa ou retirar na loja.
 *
 * As DUAS opções ficam sempre à vista e, para cliente novo, NENHUMA nasce
 * marcada. Retirada pré-marcada deixaria quem é de outra cidade pagar sem
 * perceber que teria de buscar a peça em Balneário Camboriú; entrega
 * pré-marcada esconderia que existe retirada grátis. Quem já tem endereço salvo nasce em
 * "Receber em casa" no principal — mas ainda confirma com "Continuar": enviar
 * para um endereço antigo errado custa mais que um toque.
 *
 * Tudo vem por props: o estado (escolha, cotação, cache) mora no fluxo, que
 * precisa dele para o resumo, para o passo 4 e para reagir às recusas do
 * pagamento.
 */

export const ENDERECO_LOJA =
  "Rua 3650, nº 3573 — Sala 2, Balneário Camboriú/SC";

export function linhasEndereco(a: CustomerAddress): string[] {
  return [
    [a.street, a.number, a.complement].filter(Boolean).join(", "),
    [a.district, `${a.city}/${a.state}`].filter(Boolean).join(", "),
    `CEP ${a.cep}`,
  ];
}

const caixaOpcao = (marcada: boolean) =>
  `flex cursor-pointer items-start gap-3 rounded-sm border px-4 py-3.5 transition-colors ${
    marcada ? "border-foreground" : "border-border hover:border-foreground/60"
  }`;
const radio = "mt-0.5 h-5 w-5 shrink-0 accent-foreground";

/** Como receber: as duas opções LADO A LADO, em blocos. Antes eram cartões
 * com rádio iguais aos do endereço e do frete, empilhados — e com "Retirar na
 * loja" lá embaixo, depois dos fretes, a tela parecia ter duas opções
 * marcadas ao mesmo tempo (o dono apontou, 06/10/2026). Agora a pergunta de
 * cima tem cara própria, e endereço e frete têm título. */
const blocoMetodo = (marcado: boolean) =>
  `relative flex cursor-pointer flex-col rounded-sm border px-4 py-3.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
    marcado
      ? "border-foreground bg-foreground text-background"
      : "border-border hover:border-foreground/60"
  }`;
const subtitulo = "text-sm font-medium";

export function StepDelivery({
  method,
  onMethod,
  enderecos,
  addressId,
  onAddress,
  formAberto,
  onOpenForm,
  onCloseForm,
  onAddressSaved,
  onNeedsLogin,
  quote,
  quoting,
  servicoEscolhido,
  onFrete,
  onRetry,
  entregaValida,
  onContinue,
  aviso,
  whatsappHref,
}: {
  method: "delivery" | "pickup" | null;
  onMethod: (m: "delivery" | "pickup") => void;
  enderecos: CustomerAddress[];
  addressId: string | null;
  onAddress: (id: string) => void;
  formAberto: boolean;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onAddressSaved: (a: CustomerAddress) => void;
  onNeedsLogin: () => void;
  quote: QuoteResult | null;
  quoting: boolean;
  servicoEscolhido: number | null;
  onFrete: (o: ShippingOption) => void;
  onRetry: () => void;
  entregaValida: boolean;
  onContinue: () => void;
  aviso: string | null;
  whatsappHref: string;
}) {
  const entrega = method === "delivery";
  const temSelecionado =
    !!addressId && enderecos.some((a) => a.id === addressId);

  let frete: ReactNode = null;
  if (entrega && !formAberto && temSelecionado) {
    if (quoting)
      frete = (
        <p role="status" className="text-sm text-muted">
          Calculando frete…
        </p>
      );
    else if (quote && !quote.ok && quote.unavailable)
      frete = (
        <p className="text-sm text-muted">
          O frete deste pedido é combinado pelo WhatsApp depois do pagamento.
        </p>
      );
    else if (quote && !quote.ok)
      frete = (
        <div className="space-y-2 text-sm">
          <p role="alert" className="text-red-600 dark:text-red-400">
            {quote.error ?? "Não conseguimos cotar o frete agora."}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-11 items-center justify-center rounded-xs border border-border px-5 text-sm font-medium hover:border-foreground"
          >
            Tentar cotar de novo
          </button>
          <p className="text-muted">
            Você também pode retirar na loja ou{" "}
            <Link
              href={whatsappHref}
              prefetch={false}
              className="underline underline-offset-4 hover:text-foreground"
            >
              fechar pelo WhatsApp
            </Link>
            .
          </p>
        </div>
      );
    else if (quote?.ok)
      frete = (
        <div>
          <p className={subtitulo}>Frete</p>
          <ShippingOptions
            options={quote.options}
            selectedServiceId={servicoEscolhido}
            onSelect={onFrete}
          />
        </div>
      );
  }

  // Sem `<form>` em volta de propósito: o endereço rápido é um formulário
  // próprio — form dentro de form é HTML inválido e o Enter enviaria o de
  // fora. Aqui não há campo de texto, então não se perde o Enter.
  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="sr-only">Como receber</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className={blocoMetodo(entrega)}>
            <input
              type="radio"
              name="entrega"
              checked={entrega}
              onChange={() => onMethod("delivery")}
              className="sr-only"
            />
            <span className="font-medium">Receber em casa</span>
            <span className={entrega ? "opacity-80" : "text-muted"}>
              Frete pelo CEP
            </span>
          </label>
          <label className={blocoMetodo(method === "pickup")}>
            <input
              type="radio"
              name="entrega"
              checked={method === "pickup"}
              onChange={() => onMethod("pickup")}
              className="sr-only"
            />
            <span className="font-medium">Retirar na loja</span>
            <span className={method === "pickup" ? "opacity-80" : "text-muted"}>
              Grátis
            </span>
          </label>
        </div>
      </fieldset>

      {method === "pickup" && (
        <p className="rounded-sm bg-surface px-4 py-3 text-sm">
          Retire em <span className="font-medium">{ENDERECO_LOJA}</span>.
          Avisamos por e-mail quando estiver separado.
        </p>
      )}

      {entrega && (
        <div className="space-y-4 pb-2 pt-3">
          {formAberto ? (
            <AddressQuickForm
              onSaved={onAddressSaved}
              onCancel={enderecos.length > 0 ? onCloseForm : undefined}
              onNeedsLogin={onNeedsLogin}
            />
          ) : (
            <>
              <fieldset className="space-y-2">
                <legend className={`${subtitulo} mb-2`}>
                  Endereço de entrega
                </legend>
                {enderecos.map((a) => {
                  const marcado = a.id === addressId;
                  const [l1, l2, l3] = linhasEndereco(a);
                  return (
                    <label key={a.id} className={caixaOpcao(marcado)}>
                      <input
                        type="radio"
                        name="endereco"
                        checked={marcado}
                        onChange={() => onAddress(a.id)}
                        className={radio}
                      />
                      <span className="text-sm leading-relaxed">
                        {a.label && (
                          <span className="block font-medium">{a.label}</span>
                        )}
                        <span
                          className={a.label ? "block text-muted" : "block"}
                        >
                          {l1}
                        </span>
                        <span className="block text-muted">{l2}</span>
                        <span className="block text-muted">{l3}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              <button
                type="button"
                onClick={onOpenForm}
                className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-muted"
              >
                Usar outro endereço
              </button>
              {frete}
            </>
          )}
        </div>
      )}

      {aviso && (
        <p role="status" className="text-sm text-foreground">
          {aviso}
        </p>
      )}

      <button
        type="button"
        onClick={onContinue}
        disabled={!entregaValida}
        className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-xs bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Continuar
      </button>
    </div>
  );
}
