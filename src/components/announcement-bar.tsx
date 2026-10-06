import { mensagensDaFaixa, type AvisoConfig } from "@/lib/home-config";

/**
 * Faixa preta acima do cabeçalho: as condições da loja se revezando no mesmo
 * lugar. Zero consulta própria (as mensagens vêm da configuração publicada da
 * página inicial, já em cache) e zero JS — o rodízio é CSS.
 *
 * Só promete o que o site cumpre: a mensagem de frete é AUTOMÁTICA
 * (`textoAvisoFrete`) — "Frete grátis acima de R$ X" só com a cotação ligada
 * (`freteAtivo`); sem o token do Melhor Envio o frete é combinado pelo WhatsApp
 * e ela vira "Enviamos para todo o Brasil". O editor do painel pode mudá-la de
 * lugar ou desligá-la, nunca reescrevê-la.
 *
 * O rodízio original (`.aviso-rodizio`, globals.css) foi desenhado para 4
 * mensagens de 4 s num ciclo de 16 s. Com outra quantidade, o ciclo é refeito
 * aqui para N × 4 s, com as mesmas proporções — senão, com 5 mensagens, duas
 * apareceriam sobrepostas. Com uma só, ela fica parada.
 *
 * Com `prefers-reduced-motion` fica só a primeira mensagem, parada.
 *
 * Cores: preta no tema claro e INVERTIDA (branca, texto preto) no escuro, a
 * pedido do dono (06/10/2026) — preta sobre o cabeçalho preto do tema escuro
 * a faixa sumia.
 */
export function AnnouncementBar({
  avisos,
  freteAtivo,
}: {
  avisos: AvisoConfig[];
  freteAtivo: boolean;
}) {
  const mensagens = mensagensDaFaixa(avisos, freteAtivo);
  const n = mensagens.length;
  if (n === 0) return null;

  if (n === 1) {
    return (
      <div className="bg-black text-white dark:bg-white dark:text-black">
        <p className="mx-auto flex h-9 items-center justify-center px-4 text-center text-xs font-medium">
          {mensagens[0]}
        </p>
      </div>
    );
  }

  // 4 mensagens = exatamente a regra do globals.css (sem CSS extra).
  const proprio = n !== 4;
  const classe = `aviso-rodizio-${n}`;
  const fatia = 100 / n; // % do ciclo em que cada mensagem aparece
  const css = `@keyframes ${classe}{0%{opacity:0;transform:translateY(6px)}${(fatia * 0.08).toFixed(2)}%,${(fatia * 0.92).toFixed(2)}%{opacity:1;transform:none}${fatia.toFixed(2)}%,100%{opacity:0;transform:translateY(-6px)}}.${classe}>*{animation-name:${classe};animation-duration:${n * 4}s}@media (prefers-reduced-motion:reduce){.${classe}>*{animation:none}}`;

  return (
    <div className="bg-black text-white dark:bg-white dark:text-black">
      {proprio && <style>{css}</style>}
      <p
        className={`aviso-rodizio relative mx-auto h-9 text-center text-xs font-medium ${proprio ? classe : ""}`}
      >
        {mensagens.map((m, i) => (
          <span
            key={i}
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
