import type {
  AudienceDetailResult,
  ColunaTipo,
  DetalheSecao,
} from "@/lib/analytics";

const nf = new Intl.NumberFormat("pt-BR");
const pf = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
});

function celula(v: string | number, tipo: ColunaTipo): string {
  if (tipo === "texto") return String(v) || "(não definido)";
  if (tipo === "data") {
    const [y, m, d] = String(v).split("-");
    return d ? `${d}/${m}/${y}` : String(v);
  }
  const n = Number(v) || 0;
  if (tipo === "percentual") return pf.format(n);
  if (tipo === "duracao") {
    const s = Math.round(n);
    return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
  }
  return nf.format(n);
}

function Secao({ s }: { s: DetalheSecao }) {
  return (
    <section className="mb-8 last:mb-0">
      <h3 className="text-sm font-semibold">{s.titulo}</h3>
      {s.nota && <p className="mt-0.5 text-xs text-muted">{s.nota}</p>}
      {s.linhas.length === 0 ? (
        <p className="mt-3 rounded-xs bg-surface px-3 py-4 text-sm text-muted">
          Nenhum dado no período.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted">
              <tr>
                {s.colunas.map((c) => (
                  <th
                    key={c.rotulo}
                    className={`whitespace-nowrap py-2 pr-4 font-medium last:pr-0 ${
                      c.tipo === "texto" || c.tipo === "data" ? "" : "text-right"
                    }`}
                  >
                    {c.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {s.linhas.map((linha, i) => (
                <tr key={i}>
                  {linha.map((v, j) => {
                    const tipo = s.colunas[j]?.tipo ?? "texto";
                    const texto = tipo === "texto";
                    return (
                      <td
                        key={j}
                        className={`py-2 pr-4 last:pr-0 ${
                          texto
                            ? "max-w-[28rem] break-words"
                            : tipo === "data"
                              ? "whitespace-nowrap"
                              : "whitespace-nowrap text-right tabular-nums"
                        }`}
                      >
                        {celula(v, tipo)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Conteúdo do modal de detalhe: tabelas, ou o motivo de não haver dados. */
export function AudienceDetailView({ result }: { result: AudienceDetailResult }) {
  if (result.status === "unconfigured") {
    return (
      <p className="text-sm text-muted">
        O Google Analytics ainda não está ligado ao painel. O passo a passo está
        na seção Audiência da Visão geral.
      </p>
    );
  }
  if (result.status === "error") {
    return (
      <div>
        <p className="text-sm font-semibold">O Google Analytics não respondeu.</p>
        <p className="mt-3 rounded-xs bg-surface px-3 py-2 font-mono text-xs">
          {result.message}
        </p>
      </div>
    );
  }
  return (
    <>
      {result.data.secoes.map((s) => (
        <Secao key={s.titulo} s={s} />
      ))}
      <p className="mt-6 text-xs text-muted">
        Fonte: Google Analytics
        {result.data.periodo === null
          ? ", atualizado a cada minuto"
          : ", atualizado a cada 15 minutos"}
        . Conta só quem aceitou os cookies de medição.
      </p>
    </>
  );
}

/**
 * O que o modal mostra enquanto o Google responde.
 *
 * O detalhe é streamado (Suspense no `page.tsx`): o modal abre assim que o
 * resto da tela está pronto, e isto ocupa o lugar das tabelas. Antes a página
 * inteira esperava o Google — clique, nada na tela por segundos, e aí tudo de
 * uma vez. Mesmo desenho das seções reais, para não pular quando elas chegam.
 */
export function DetalheCarregando() {
  return (
    <div aria-busy="true" aria-label="Carregando detalhes">
      <p className="sr-only">Buscando no Google Analytics…</p>
      {[0, 1, 2].map((s) => (
        <section key={s} className="mb-8 last:mb-0 animate-pulse">
          <div className="h-4 w-40 rounded-xs bg-surface" />
          <div className="mt-3 divide-y divide-border border-t border-border">
            {[0, 1, 2, 3].map((l) => (
              <div key={l} className="flex justify-between gap-4 py-2.5">
                <div className="h-3.5 w-1/2 rounded-xs bg-surface" />
                <div className="h-3.5 w-10 rounded-xs bg-surface" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
