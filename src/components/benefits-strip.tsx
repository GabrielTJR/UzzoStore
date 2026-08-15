/**
 * Faixa de benefícios — o "por que comprar aqui" que toda loja moderna mostra
 * logo abaixo do hero. 100% estática: zero consulta, zero JS.
 * No celular vira uma faixa horizontal deslizável (4 itens empilhados
 * empurrariam o catálogo para fora da primeira dobra).
 */
const BENEFICIOS = [
  {
    titulo: "Retirada na loja",
    detalhe: "Balneário Camboriú · SC",
    icone: (
      <path d="M3 9.5 12 4l9 5.5M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9M9 20v-6h6v6" />
    ),
  },
  {
    titulo: "Envio para todo o Brasil",
    detalhe: "combinado pelo WhatsApp",
    icone: (
      <path d="M1 8h14v9H1zM15 11h4l3 3v3h-7zM5.5 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
    ),
  },
  {
    titulo: "Pix ou cartão",
    detalhe: "pagamento seguro em até 3x",
    icone: <path d="M2 7h20v11H2zM2 10h20M6 15h4" />,
  },
  {
    titulo: "Atendimento direto",
    detalhe: "WhatsApp (47) 99174-4865",
    icone: (
      <path d="M21 12a9 9 0 1 0-3.5 7.1L21 20l-.8-3.2A8.9 8.9 0 0 0 21 12z" />
    ),
  },
];

export function BenefitsStrip() {
  return (
    <section aria-label="Vantagens da loja" className="border-y border-border">
      <div className="scrollbar-hide mx-auto flex max-w-6xl snap-x snap-mandatory gap-8 overflow-x-auto px-6 py-5 sm:grid sm:snap-none sm:grid-cols-4 sm:gap-6">
        {BENEFICIOS.map((b) => (
          <div
            key={b.titulo}
            className="flex min-w-[70%] snap-start items-center gap-3 sm:min-w-0"
          >
            <svg
              viewBox="0 0 24 24"
              width="26"
              height="26"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="shrink-0 text-muted"
            >
              {b.icone}
            </svg>
            <div>
              <p className="text-sm font-medium leading-tight">{b.titulo}</p>
              <p className="text-xs text-muted">{b.detalhe}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
