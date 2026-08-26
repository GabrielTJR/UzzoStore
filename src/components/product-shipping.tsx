"use client";

import { useState } from "react";
import { formatBRL } from "@/lib/format";
import { nomeServicoFrete, FRETE_GRATIS_MIN } from "@/lib/shipping-config";
import { quoteShippingAction } from "@/app/sacola/shipping-actions";
import type { ShippingOption } from "@/lib/shipping";

/**
 * Calculadora de frete NA PÁGINA DO PRODUTO.
 *
 * Antes, o cliente só descobria o preço do envio depois de adicionar à sacola e
 * ir para outra tela. Frete escondido lê como evasivo, e frete surpresa é a
 * causa nº 1 de carrinho abandonado — pior ainda numa loja de Balneário
 * Camboriú, onde a diferença é grande: medido em 21/08/2026, o mesmo pacote
 * custa R$ 13,93 para Itajaí e R$ 73,95 para Salvador. Deixar isso para o fim
 * é convidar o cliente a desistir tarde.
 *
 * É EXIBIÇÃO, não escolha: aqui o cliente só quer saber quanto custa e quando
 * chega. A escolha do serviço continua acontecendo na sacola/checkout, onde o
 * servidor recota e valida.
 *
 * Cota com UMA peça: o peso vem do produto (`weight_grams` ou padrão da
 * categoria), então qualquer variante dele dá o mesmo resultado — não é preciso
 * escolher tamanho antes de ver o frete.
 */
export function ProductShipping({ variantId }: { variantId: string | null }) {
  const [cep, setCep] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [res, setRes] = useState<
    | { tipo: "ok"; opcoes: ShippingOption[]; gratis: boolean }
    | { tipo: "erro"; msg: string }
    | null
  >(null);

  const cepLimpo = cep.replace(/\D/g, "");
  const podeCotar = cepLimpo.length === 8 && !!variantId && !carregando;

  function formatarCep(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  }

  async function calcular() {
    if (!podeCotar || !variantId) return;
    setCarregando(true);
    setRes(null);
    try {
      const r = await quoteShippingAction(cepLimpo, [{ variantId, qty: 1 }]);
      if (r.ok) setRes({ tipo: "ok", opcoes: r.options, gratis: r.freeApplied });
      else if (r.unavailable)
        setRes({
          tipo: "erro",
          msg: "Combinamos o frete pelo WhatsApp — é só chamar.",
        });
      else setRes({ tipo: "erro", msg: r.error ?? "Não conseguimos cotar agora." });
    } catch {
      setRes({ tipo: "erro", msg: "Não conseguimos cotar agora." });
    } finally {
      setCarregando(false);
    }
  }

  if (!variantId) return null;

  return (
    <div className="mt-6 rounded-md border border-border p-4">
      <p className="text-sm font-medium">Frete e prazo</p>

      <div className="mt-3 flex gap-2">
        <input
          value={cep}
          onChange={(e) => setCep(formatarCep(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              calcular();
            }
          }}
          inputMode="numeric"
          placeholder="00000-000"
          aria-label="CEP para calcular o frete"
          className="h-10 w-32 rounded-md border border-border bg-transparent px-3 text-sm"
        />
        <button
          type="button"
          onClick={calcular}
          disabled={!podeCotar}
          className="h-10 rounded-md border border-foreground px-4 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {carregando ? "Calculando…" : "Calcular"}
        </button>
      </div>

      {res?.tipo === "erro" && (
        <p className="mt-3 text-sm text-muted">{res.msg}</p>
      )}

      {res?.tipo === "ok" && (
        <ul className="mt-3 space-y-2 text-sm">
          {res.opcoes.map((o) => (
            <li key={o.serviceId} className="flex justify-between gap-3">
              <span>
                {o.tag === "rapido"
                  ? "Mais rápido"
                  : o.tag === "ambos"
                    ? "Melhor opção"
                    : o.tag === "barato"
                      ? "Mais barato"
                      : nomeServicoFrete(o.serviceId, o.name, o.company)}
                {o.days > 0 && (
                  <span className="block text-xs text-muted">
                    até {o.days} dias úteis ·{" "}
                    {nomeServicoFrete(o.serviceId, o.name, o.company)}
                  </span>
                )}
              </span>
              <strong className="whitespace-nowrap">
                {o.free ? "Grátis 🎉" : formatBRL(o.price)}
              </strong>
            </li>
          ))}
        </ul>
      )}

      {/* O valor é de UMA peça: com a sacola cheia o frete grátis pode entrar, e
          prometer aqui o que a sacola não confirma seria pior que não avisar. */}
      {res?.tipo === "ok" && !res.gratis && FRETE_GRATIS_MIN != null && (
        <p className="mt-3 text-xs text-muted">
          Frete grátis em compras a partir de {formatBRL(FRETE_GRATIS_MIN)}.
        </p>
      )}

      <p className="mt-3 text-xs text-muted">
        Cálculo para 1 peça. Também dá para retirar na loja, sem frete.
      </p>
    </div>
  );
}
