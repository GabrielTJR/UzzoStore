import { FRETE_GRATIS_MIN } from "@/lib/shipping-config";
import { formatBRL } from "@/lib/format";

/**
 * Faixa preta acima do cabeçalho: as condições da loja se revezando no mesmo
 * lugar. 100% estática (zero consulta, zero JS — o rodízio é CSS).
 *
 * Só promete o que o site cumpre: o frete grátis entra apenas com a cotação
 * ligada (`freteAtivo`), porque sem o token do Melhor Envio o frete é
 * combinado pelo WhatsApp e não há mínimo nenhum para anunciar.
 *
 * Com `prefers-reduced-motion` fica só a primeira mensagem, parada.
 */
export function AnnouncementBar({ freteAtivo }: { freteAtivo: boolean }) {
  const mensagens = [
    ...(freteAtivo && FRETE_GRATIS_MIN != null
      ? [
          `Frete grátis acima de ${formatBRL(FRETE_GRATIS_MIN).replace(",00", "")}`,
        ]
      : ["Enviamos para todo o Brasil"]),
    "3x sem juros no cartão",
    "Troca em até 30 dias",
    "Retire na loja em Balneário Camboriú",
  ];

  return (
    <div className="bg-black text-white">
      <p className="aviso-rodizio relative mx-auto h-9 text-center text-xs font-medium">
        {mensagens.map((m, i) => (
          <span
            key={m}
            className="absolute inset-0 flex items-center justify-center px-4"
            style={{ animationDelay: `${i * 4}s` }}
          >
            {m}
          </span>
        ))}
      </p>
    </div>
  );
}
