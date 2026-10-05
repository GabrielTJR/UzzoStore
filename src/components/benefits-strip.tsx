import {
  IconCard,
  IconChat,
  IconStore,
  IconSwap,
  IconTruck,
} from "@/components/icons";
import { FRETE_GRATIS_MIN } from "@/lib/shipping-config";
import { WHATSAPP_NUMBER_DISPLAY } from "@/lib/store-info";
import { formatBRL } from "@/lib/format";

/**
 * Condições da loja — o "por que comprar aqui". 100% estática: zero consulta,
 * zero JS. No celular é uma grade 2×2 (uma fileira que desliza escondia metade
 * dos itens atrás de um gesto que ninguém fazia).
 *
 * Mesma regra da faixa do topo: frete grátis só aparece com a cotação ligada.
 */
export function BenefitsStrip({ freteAtivo }: { freteAtivo: boolean }) {
  const itens = [
    freteAtivo && FRETE_GRATIS_MIN != null
      ? {
          icone: <IconTruck size={26} />,
          titulo: "Frete grátis",
          detalhe: `acima de ${formatBRL(FRETE_GRATIS_MIN).replace(",00", "")}`,
        }
      : {
          icone: <IconTruck size={26} />,
          titulo: "Envio para todo o Brasil",
          detalhe: "combinado pelo WhatsApp",
        },
    {
      icone: <IconCard size={26} />,
      titulo: "3x sem juros",
      detalhe: "ou até 12x no cartão, e Pix",
    },
    {
      icone: <IconSwap size={26} />,
      titulo: "Troca em até 30 dias",
      detalhe: "veja como funciona em Trocas",
    },
    {
      icone: <IconStore size={26} />,
      titulo: "Retire na loja",
      detalhe: "em Balneário Camboriú",
    },
    {
      icone: <IconChat size={26} />,
      titulo: "Atendimento direto",
      detalhe: `WhatsApp ${WHATSAPP_NUMBER_DISPLAY}`,
    },
  ];

  return (
    <section aria-label="Condições da loja" className="bg-surface">
      <ul className="px-page grid grid-cols-2 gap-x-4 gap-y-6 py-8 lg:grid-cols-5 lg:py-10">
        {itens.map((b, i) => (
          <li
            key={b.titulo}
            // O 5º item sobraria sozinho numa grade de 2 colunas.
            className={`flex items-start gap-3 ${i === 4 ? "max-lg:hidden" : ""}`}
          >
            <span className="shrink-0">{b.icone}</span>
            <div>
              <p className="text-sm font-semibold leading-tight">{b.titulo}</p>
              <p className="mt-0.5 text-xs leading-snug text-muted">
                {b.detalhe}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
