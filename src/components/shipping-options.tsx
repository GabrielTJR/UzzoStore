"use client";

import { useState } from "react";
import type { ShippingOption } from "@/lib/shipping";
import { nomeServicoFrete } from "@/lib/shipping-config";
import { formatBRL } from "@/lib/format";

/**
 * Lista de opções de frete — usada na sacola E no checkout, para as duas telas
 * não divergirem.
 *
 * Duas decisões de produto vivem aqui:
 *
 * 1. O rótulo é o BENEFÍCIO, não o nome do serviço. ".Package Centralizado ·
 *    Jadlog" não significa nada para quem compra camisa; "Mais barato · até 8
 *    dias úteis" significa. A transportadora continua visível em segundo plano,
 *    porque parte do cliente confia (ou desconfia) de transportadora específica.
 *
 * 2. Só as opções COM benefício aparecem de saída; o resto fica atrás de "ver
 *    outras opções". Três caixas de rádio vazias obrigam o cliente a decidir
 *    entre nomes que ele não entende, bem no passo em que ele está mais perto de
 *    desistir.
 *
 * NÃO fixe uma transportadora no lugar disso. Medido em 21/08/2026, saindo de
 * Balneário Camboriú: o SEDEX é o mais barato para Itajaí (20 km), mas é a opção
 * MAIS CARA das 13 para São Paulo (R$ 35,86 contra R$ 15,14) e para o Rio
 * (R$ 49,71 contra R$ 15,38) — no mesmo prazo, numa cesta de 4 peças. Para
 * Salvador, R$ 73,95 contra R$ 17,65. Fixar SEDEX cobraria isso do cliente.
 */
const ROTULO: Record<
  NonNullable<ShippingOption["tag"]>,
  { titulo: string; nota: string }
> = {
  ambos: { titulo: "Melhor opção", nota: "mais rápida e mais barata" },
  barato: { titulo: "Mais barato", nota: "" },
  rapido: { titulo: "Mais rápido", nota: "" },
  equilibrio: { titulo: "Recomendado", nota: "" },
};

export function ShippingOptions({
  options,
  selectedServiceId,
  onSelect,
}: {
  options: ShippingOption[];
  selectedServiceId: number | null;
  onSelect: (o: ShippingOption) => void;
}) {
  const [verTodas, setVerTodas] = useState(false);

  // A escolhida SEMPRE aparece, mesmo recolhida: esconder o que está marcado
  // deixaria o cliente sem saber o que vai pagar.
  const visiveis = verTodas
    ? options
    : options.filter((o) => o.tag || o.serviceId === selectedServiceId);
  const escondidas = options.length - visiveis.length;

  // Com frete grátis a loja cobre até a opção recomendada: as cobertas saem
  // grátis e as mais rápidas viram "Outros fretes", cobrando só a diferença.
  const gratis = options.filter((o) => o.free);
  const pagos = options.filter((o) => !o.free);
  const subsidiado = gratis.length > 0 && pagos.length > 0;

  function Opcao({ o }: { o: ShippingOption }) {
    const selected = selectedServiceId === o.serviceId;
    // "Mais rápido" e "Melhor opção" são as duas formas de a opção ser a
    // mais veloz da lista — as duas ganham o destaque.
    const rapida = o.tag === "rapido" || o.tag === "ambos";
    const rotulo = o.tag ? ROTULO[o.tag] : null;
    // Nunca o nome cru da API: ".Package Centralizado", ".Com" e "Standard"
    // são jargão de transportadora, não linguagem de loja.
    const servico = nomeServicoFrete(o.serviceId, o.name, o.company);
    const titulo = rotulo ? rotulo.titulo : servico;
    const detalhe = [
      o.days > 0 ? `até ${o.days} dias úteis` : null,
      rotulo ? servico : null,
      rotulo?.nota || null,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <label
        key={o.serviceId}
        className={`relative flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${
          selected
            ? "border-foreground"
            : rapida
              ? "border-foreground/40 hover:border-foreground"
              : "border-border hover:border-foreground"
        }`}
      >
        <span className="flex items-center gap-2">
          <input
            type="radio"
            name="frete"
            checked={selected}
            onChange={() => onSelect(o)}
          />
          <span>
            <span className="font-medium">
              {titulo}
              {rapida && (
                <span className="ml-2 rounded-full bg-foreground px-2 py-0.5 align-middle text-[0.65rem] font-medium text-background">
                  chega antes
                </span>
              )}
            </span>
            {detalhe && (
              <span className="block text-xs text-muted">{detalhe}</span>
            )}
          </span>
        </span>
        <strong>{o.free ? "Grátis" : formatBRL(o.price)}</strong>
      </label>
    );
  }

  return (
    <div
      className="mt-3 space-y-2"
      role="radiogroup"
      aria-label="Opções de frete"
    >
      {gratis.length > 0 && (
        <div className="space-y-2">
          {gratis.map((o) => (
            <Opcao key={o.serviceId} o={o} />
          ))}
        </div>
      )}

      {pagos.length > 0 && (
        <div className="space-y-2">
          {subsidiado && (
            <p className="pt-1 text-xs text-muted">
              <span className="font-medium text-foreground">Outros fretes</span>
              {" — chegam antes, e você paga só a diferença."}
            </p>
          )}
          {pagos.map((o) => (
            <Opcao key={o.serviceId} o={o} />
          ))}
        </div>
      )}

      {!verTodas && escondidas > 0 && (
        <button
          type="button"
          onClick={() => setVerTodas(true)}
          className="text-xs text-muted underline underline-offset-4 hover:text-foreground"
        >
          ver outras opções ({escondidas})
        </button>
      )}
    </div>
  );
}
