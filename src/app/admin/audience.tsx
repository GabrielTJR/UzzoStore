import Link from "next/link";
import type {
  AudienceData,
  AudienceResult,
  DetalheKind,
} from "@/lib/analytics";
import { Panel } from "./admin-ui";

/** Endereço do detalhe de um card (o modal abre por URL). */
export function detalheHref(kind: DetalheKind, periodo?: number): string {
  return `/admin?detalhe=${kind}${periodo ? `&periodo=${periodo}` : ""}`;
}

/** "Ver detalhes" no canto de um painel. Sem prefetch: cada abertura é uma
 * consulta ao Google, e o prefetch dispararia uma para cada card à vista. */
function VerDetalhes({ kind, periodo }: { kind: DetalheKind; periodo?: number }) {
  return (
    <Link
      href={detalheHref(kind, periodo)}
      scroll={false}
      prefetch={false}
      className="shrink-0 text-xs font-medium underline underline-offset-4 hover:text-muted"
    >
      Ver detalhes
    </Link>
  );
}

const nf = new Intl.NumberFormat("pt-BR");
const fmt = (n: number) => nf.format(n);

function diaCurto(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}

/** Card de número: rótulo, valor e uma linha de apoio. */
function Stat({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail?: string;
  /** Com endereço, o card inteiro abre o detalhe. */
  href?: string;
}) {
  const conteudo = (
    <>
      <p className="flex items-baseline justify-between gap-2 text-sm text-muted">
        {label}
        {href && <span className="text-xs underline underline-offset-4">detalhes</span>}
      </p>
      <p className="mt-1 text-3xl font-semibold leading-none">{value}</p>
      {detail && <p className="mt-2 text-xs text-muted">{detail}</p>}
    </>
  );
  if (!href) return <Panel className="p-4 lg:p-5">{conteudo}</Panel>;
  return (
    <Link
      href={href}
      scroll={false}
      prefetch={false}
      className="block rounded-sm border border-border bg-background p-4 transition-colors hover:border-foreground lg:p-5"
    >
      {conteudo}
    </Link>
  );
}

/**
 * Visitantes por dia, 28 dias. Uma série só (o título diz qual é, então não há
 * legenda), barras finas com a ponta arredondada, valor no passar do mouse ou
 * no foco do teclado. A lista de números está logo ao lado nos cards — o
 * gráfico mostra o desenho da curva, não substitui a tabela.
 */
function DailyBars({ daily }: { daily: AudienceData["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.visitors));
  const marcas = [0, Math.floor(daily.length / 2), daily.length - 1];
  return (
    <div>
      <div
        role="img"
        aria-label={`Visitantes por dia nos últimos 28 dias; pico de ${fmt(max)}.`}
        className="flex h-40 items-end gap-[2px]"
      >
        {daily.map((d) => (
          <div
            key={d.date}
            tabIndex={0}
            className="group relative flex h-full flex-1 items-end outline-none"
          >
            <div
              className="w-full rounded-t-[3px] bg-accent/80 transition-colors group-hover:bg-accent group-focus-visible:bg-accent"
              style={{
                height: `${Math.max(d.visitors > 0 ? 3 : 0, (d.visitors / max) * 100)}%`,
              }}
            />
            {/* Dia sem visita: um traço na base, para o dia não sumir do eixo. */}
            {d.visitors === 0 && (
              <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
            )}
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-xs bg-foreground px-2 py-1 text-xs text-background group-hover:block group-focus-visible:block">
              {diaCurto(d.date)}: {fmt(d.visitors)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-border pt-1.5 text-xs text-muted">
        {marcas.map((i) => (
          <span key={i}>{diaCurto(daily[i].date)}</span>
        ))}
      </div>
    </div>
  );
}

/** Lista ordenada com barra de proporção: nome, valor e a barra fina embaixo. */
function Ranking({
  rows,
  vazio,
}: {
  rows: { name: string; value: number }[];
  vazio: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted">{vazio}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="space-y-3">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate" title={r.name}>
              {r.name}
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {fmt(r.value)}
            </span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-accent/80"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}


/**
 * Audiência do site (Google Analytics) na Visão geral do painel.
 *
 * Três estados: funcionando, sem configurar (mostra o passo a passo) e com erro
 * (mostra o que o Google respondeu — quase sempre é permissão faltando).
 */
export function Audience({ result }: { result: AudienceResult }) {
  if (result.status === "unconfigured") {
    return (
      <Panel className="p-5 lg:p-6">
        <h3 className="text-sm font-semibold">
          Ligue o Google Analytics para ver visitas aqui
        </h3>
        <p className="mt-1 max-w-[75ch] text-sm text-muted">
          O site já envia as visitas para o Google Analytics. Para o painel
          conseguir LER esses números, o Google exige uma credencial de leitura.
          É uma configuração única:
        </p>
        <ol className="mt-4 max-w-[75ch] list-decimal space-y-2 pl-5 text-sm">
          <li>
            No Google Cloud, crie um projeto, ative a{" "}
            <strong>Google Analytics Data API</strong> e crie uma{" "}
            <strong>conta de serviço</strong>. Gere uma chave JSON para ela.
          </li>
          <li>
            No Google Analytics, em Administrador → Gerenciamento de acesso à
            propriedade, adicione o e-mail da conta de serviço como{" "}
            <strong>Leitor</strong>.
          </li>
          <li>
            Cadastre três variáveis no servidor (Vercel e <code>.env.local</code>
            ): <code>GA_PROPERTY_ID</code> (o número da propriedade, não o
            G-XXXX), <code>GA_SERVICE_ACCOUNT_EMAIL</code> e{" "}
            <code>GA_SERVICE_ACCOUNT_KEY</code> (o campo <code>private_key</code>{" "}
            do JSON).
          </li>
        </ol>
      </Panel>
    );
  }

  if (result.status === "error") {
    return (
      <Panel className="p-5 lg:p-6">
        <h3 className="text-sm font-semibold">
          O Google Analytics não respondeu
        </h3>
        <p className="mt-1 text-sm text-muted">
          As variáveis estão cadastradas, mas a leitura falhou. Resposta do
          Google:
        </p>
        <p className="mt-3 rounded-xs bg-surface px-3 py-2 font-mono text-xs">
          {result.message}
        </p>
        <p className="mt-3 max-w-[75ch] text-sm text-muted">
          O mais comum: a conta de serviço não foi adicionada como Leitor na
          propriedade, a Data API não está ativada no projeto, ou o{" "}
          <code>GA_PROPERTY_ID</code> é de outra propriedade.
        </p>
      </Panel>
    );
  }

  const { data, agora } = result;
  const porDispositivo = data.devices.reduce((n, d) => n + d.visitors, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat
          label="No site agora"
          href={detalheHref("agora")}
          value={agora == null ? "—" : fmt(agora)}
          detail="visitantes nos últimos 30 minutos"
        />
        {data.periods.map((p) => (
          <Stat
            key={p.key}
            label={p.label}
            href={detalheHref("visitantes", p.key === "28d" ? 28 : 7)}
            value={fmt(p.visitors)}
            detail={`visitantes, ${fmt(p.views)} páginas vistas`}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel className="p-4 lg:p-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">Visitantes por dia, últimos 28 dias</h3>
            <VerDetalhes kind="visitantes" periodo={28} />
          </div>
          <DailyBars daily={data.daily} />
        </Panel>
        <Panel className="p-4 lg:p-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">Páginas mais vistas, últimos 7 dias</h3>
            <VerDetalhes kind="paginas" periodo={7} />
          </div>
          <Ranking
            rows={data.pages.map((p) => ({ name: p.path, value: p.views }))}
            vazio="Nenhuma página vista no período."
          />
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="p-4 lg:p-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">De onde vieram, últimos 7 dias</h3>
            <VerDetalhes kind="origens" periodo={7} />
          </div>
          <Ranking
            rows={data.channels.map((c) => ({
              name: c.name,
              value: c.sessions,
            }))}
            vazio="Nenhuma visita no período."
          />
        </Panel>
        <Panel className="p-4 lg:p-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">Aparelho, últimos 7 dias</h3>
            <VerDetalhes kind="aparelhos" periodo={7} />
          </div>
          <Ranking
            rows={data.devices.map((d) => ({
              name:
                porDispositivo > 0
                  ? `${d.name} (${Math.round((d.visitors / porDispositivo) * 100)}%)`
                  : d.name,
              value: d.visitors,
            }))}
            vazio="Nenhuma visita no período."
          />
        </Panel>
      </div>

      <p className="max-w-[90ch] text-xs text-muted">
        Fonte: Google Analytics, atualizado a cada 15 minutos. O site só mede
        quem aceita os cookies de medição, então o movimento real é maior que
        estes números.
      </p>
    </div>
  );
}
