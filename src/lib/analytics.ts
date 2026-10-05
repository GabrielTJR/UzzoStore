import "server-only";
import { createSign } from "node:crypto";
import { unstable_cache } from "next/cache";

/**
 * Audiência da loja, lida do Google Analytics 4 (Data API) — para os cards da
 * Visão geral do painel.
 *
 * COMO FUNCIONA: uma "conta de serviço" do Google (um usuário-robô, só leitura)
 * assina um pedido de acesso com a chave privada dela e o Google devolve um
 * token de 1 h; com ele, UMA chamada (`batchRunReports`) traz os cinco
 * relatórios da tela. Sem dependência nova: a assinatura é `node:crypto`.
 *
 * CUSTO: só roda quando um admin abre a Visão geral, e o resultado fica 15 min
 * no cache do servidor (o "agora no site", 1 min). Visita de cliente NUNCA
 * dispara isto. A cota grátis da Data API é de dezenas de milhares de chamadas
 * por dia; o painel gasta, no máximo, ~100.
 *
 * ⚠️ O NÚMERO É MENOR QUE O TRÁFEGO REAL. O site só carrega o Google Analytics
 * depois que o cliente aceita os cookies de medição (ver `CookieConsent`), então
 * quem recusa ou ignora o aviso não é contado. A tela diz isso para o dono não
 * tomar o número por total.
 *
 * ENVS (todas server-only; nunca `NEXT_PUBLIC_*`):
 *   GA_PROPERTY_ID            — número da propriedade (Admin → Detalhes da
 *                               propriedade). NÃO é o "G-XXXX" de medição.
 *   GA_SERVICE_ACCOUNT_EMAIL  — e-mail da conta de serviço
 *   GA_SERVICE_ACCOUNT_KEY    — chave privada dela (campo `private_key` do JSON)
 * A conta de serviço precisa estar como "Leitor" na propriedade do GA.
 */

type Config = { propertyId: string; email: string; key: string };

function config(): Config | null {
  const propertyId = process.env.GA_PROPERTY_ID?.trim().replace(/^properties\//, "");
  const email = process.env.GA_SERVICE_ACCOUNT_EMAIL?.trim();
  // Na Vercel a chave costuma ser colada com "\n" literal no lugar das quebras.
  const key = process.env.GA_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n").trim();
  if (!propertyId || !email || !key) return null;
  return { propertyId, email, key };
}

export function analyticsConfigured(): boolean {
  return config() !== null;
}

/* ---------- token ---------- */

let tokenCache: { token: string; exp: number } | null = null;

async function accessToken(cfg: Config): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.exp - 60 > now) return tokenCache.token;

  const b64 = (v: object) =>
    Buffer.from(JSON.stringify(v)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: cfg.email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(cfg.key, "base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Google recusou a credencial: ${json.error_description ?? json.error ?? res.status}`,
    );
  }
  tokenCache = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return json.access_token;
}

/* ---------- relatórios ---------- */

type GaRow = {
  dimensionValues?: { value: string }[];
  metricValues?: { value: string }[];
};
type GaReport = { rows?: GaRow[] };

async function gaPost<T>(cfg: Config, method: string, body: object): Promise<T> {
  const token = await accessToken(cfg);
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${cfg.propertyId}:${method}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Google Analytics respondeu ${res.status}`);
  }
  return json;
}

const num = (r: GaRow | undefined, i = 0) =>
  Number(r?.metricValues?.[i]?.value ?? 0) || 0;
const dim = (r: GaRow, i = 0) => r.dimensionValues?.[i]?.value ?? "";

export type AudiencePeriod = {
  key: "hoje" | "7d" | "28d";
  label: string;
  visitors: number;
  sessions: number;
  views: number;
};

export type AudienceData = {
  periods: AudiencePeriod[];
  /** Visitantes por dia, do mais antigo ao mais recente (28 dias). */
  daily: { date: string; visitors: number }[];
  pages: { path: string; views: number }[];
  channels: { name: string; sessions: number }[];
  devices: { name: string; visitors: number }[];
  /**
   * Funil de vendas, últimos 28 dias: quantas PESSOAS chegaram a cada etapa.
   * A primeira etapa é quem visitou; as outras vêm dos eventos que o site
   * envia (`lib/track.ts`). `whatsapp` fica fora da sequência: é o outro
   * caminho de fechar a compra.
   */
  funnel: { key: string; label: string; users: number }[];
  whatsapp: number;
  fetchedAt: string;
};

const CANAIS: Record<string, string> = {
  Direct: "Acesso direto",
  "Organic Search": "Busca do Google",
  "Organic Social": "Redes sociais",
  "Paid Social": "Anúncio em rede social",
  "Paid Search": "Anúncio na busca",
  Referral: "Link em outro site",
  Email: "E-mail",
  "Organic Shopping": "Google Shopping",
  "Cross-network": "Anúncio (várias redes)",
  Unassigned: "Não identificado",
  "(other)": "Outros",
};

const APARELHOS: Record<string, string> = {
  mobile: "Celular",
  desktop: "Computador",
  tablet: "Tablet",
  "smart tv": "TV",
};

/** Etapas do funil, na ordem da compra (eventos de `lib/track.ts`). */
const ETAPAS_FUNIL = [
  { key: "view_item", label: "Viram um produto" },
  { key: "add_to_cart", label: "Adicionaram à sacola" },
  { key: "begin_checkout", label: "Começaram o checkout" },
  { key: "add_payment_info", label: "Foram para o pagamento" },
  { key: "purchase", label: "Compraram" },
] as const;

async function fetchAudience(): Promise<AudienceData> {
  const cfg = config();
  if (!cfg) throw new Error("Google Analytics não configurado");

  const ultimos7 = [{ startDate: "6daysAgo", endDate: "today" }];
  const { reports = [] } = await gaPost<{ reports?: GaReport[] }>(
    cfg,
    "batchRunReports",
    {
      requests: [
        {
          // Com mais de um período o GA devolve uma linha por período, com a
          // dimensão automática `dateRange` (date_range_0, _1, _2).
          dateRanges: [
            { startDate: "today", endDate: "today" },
            { startDate: "6daysAgo", endDate: "today" },
            { startDate: "27daysAgo", endDate: "today" },
          ],
          metrics: [
            { name: "activeUsers" },
            { name: "sessions" },
            { name: "screenPageViews" },
          ],
        },
        {
          dateRanges: [{ startDate: "27daysAgo", endDate: "today" }],
          dimensions: [{ name: "date" }],
          metrics: [{ name: "activeUsers" }],
          orderBys: [{ dimension: { dimensionName: "date" } }],
        },
        {
          dateRanges: ultimos7,
          dimensions: [{ name: "pagePath" }],
          metrics: [{ name: "screenPageViews" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: 8,
        },
        {
          dateRanges: ultimos7,
          dimensions: [{ name: "sessionDefaultChannelGroup" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 6,
        },
        {
          dateRanges: ultimos7,
          dimensions: [{ name: "deviceCategory" }],
          metrics: [{ name: "activeUsers" }],
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        },
      ],
    },
  );

  const [totais, porDia, paginas, canais, aparelhos] = reports;

  // Funil: o batch acima já está no máximo de 5 relatórios, então este vai
  // numa chamada própria. Falhar aqui não derruba a audiência: o card de
  // funil só aparece vazio.
  const eventos = await gaPost<GaReport>(cfg, "runReport", {
    dateRanges: [{ startDate: "27daysAgo", endDate: "today" }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "totalUsers" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        inListFilter: {
          values: [...ETAPAS_FUNIL.map((e) => e.key), "checkout_whatsapp"],
        },
      },
    },
  }).catch(() => ({ rows: [] }) as GaReport);
  const porEvento = new Map(
    (eventos.rows ?? []).map((r) => [dim(r), num(r)] as const),
  );

  const porPeriodo = new Map(
    (totais?.rows ?? []).map((r) => [dim(r), r] as const),
  );
  const periodo = (
    i: number,
    key: AudiencePeriod["key"],
    label: string,
  ): AudiencePeriod => {
    const r = porPeriodo.get(`date_range_${i}`);
    return {
      key,
      label,
      visitors: num(r, 0),
      sessions: num(r, 1),
      views: num(r, 2),
    };
  };

  // O GA omite os dias sem visita: preenche com zero para a série ter sempre
  // 28 barras (um buraco no eixo do tempo leria como dia inexistente).
  const visitas = new Map(
    (porDia?.rows ?? []).map((r) => [dim(r), num(r)] as const),
  );
  const daily: AudienceData["daily"] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    // Data no fuso da loja — a mesma referência de "hoje" da propriedade.
    const ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
    }).format(d);
    daily.push({ date: ymd, visitors: visitas.get(ymd.replaceAll("-", "")) ?? 0 });
  }

  return {
    periods: [
      periodo(0, "hoje", "Hoje"),
      periodo(1, "7d", "Últimos 7 dias"),
      periodo(2, "28d", "Últimos 28 dias"),
    ],
    daily,
    pages: (paginas?.rows ?? []).map((r) => ({ path: dim(r), views: num(r) })),
    channels: (canais?.rows ?? []).map((r) => ({
      name: CANAIS[dim(r)] ?? dim(r),
      sessions: num(r),
    })),
    devices: (aparelhos?.rows ?? []).map((r) => ({
      name: APARELHOS[dim(r)] ?? dim(r),
      visitors: num(r),
    })),
    funnel: [
      {
        key: "visita",
        label: "Visitaram a loja",
        users: num(porPeriodo.get("date_range_2"), 0),
      },
      ...ETAPAS_FUNIL.map((e) => ({
        key: e.key,
        label: e.label,
        users: porEvento.get(e.key) ?? 0,
      })),
    ],
    whatsapp: porEvento.get("checkout_whatsapp") ?? 0,
    fetchedAt: new Date().toISOString(),
  };
}

// Falha NUNCA entra no cache: as funções cacheadas lançam e quem chama captura
// (mesmo desenho de `lib/products.ts`). Senão uma credencial errada ficaria 15
// minutos "cacheada" como erro mesmo depois de corrigida.
const cachedAudience = unstable_cache(fetchAudience, ["ga-audiencia"], {
  revalidate: 900,
});

const cachedRealtime = unstable_cache(
  async (): Promise<number> => {
    const cfg = config();
    if (!cfg) throw new Error("Google Analytics não configurado");
    const r = await gaPost<GaReport>(cfg, "runRealtimeReport", {
      metrics: [{ name: "activeUsers" }],
    });
    return num(r.rows?.[0]);
  },
  ["ga-agora"],
  { revalidate: 60 },
);

export type AudienceResult =
  | { status: "ok"; data: AudienceData; agora: number | null }
  | { status: "unconfigured" }
  | { status: "error"; message: string };

/** Audiência para o painel. Nunca lança: a Visão geral não pode cair por isto. */
export async function getAudience(): Promise<AudienceResult> {
  if (!analyticsConfigured()) return { status: "unconfigured" };
  try {
    const [data, agora] = await Promise.all([
      cachedAudience(),
      cachedRealtime().catch(() => null),
    ]);
    return { status: "ok", data, agora };
  } catch (e) {
    console.error("[analytics] leitura do Google Analytics falhou", e);
    return {
      status: "error",
      message: e instanceof Error ? e.message : "erro desconhecido",
    };
  }
}

/* ======================================================================
 * DETALHE DOS CARDS — o modal que abre ao clicar num card de audiência.
 *
 * Mesmo desenho da visão geral: só roda quando um admin ABRE o detalhe, e o
 * resultado fica 15 min no cache (1 min para "agora"), por tipo + período. A
 * URL (`?detalhe=&periodo=`) é a única entrada, e os dois valores passam por
 * lista fechada antes de chegar aqui — nada vindo da URL vira parâmetro livre
 * da consulta ao Google.
 *
 * O formato de saída é genérico (seções com colunas tipadas) para o modal ser
 * um só: acrescentar um detalhe novo é acrescentar um caso aqui, não uma tela.
 * ==================================================================== */

export const DETALHES = {
  visitantes: "Visitantes",
  paginas: "Páginas",
  origens: "De onde vieram",
  aparelhos: "Aparelhos",
  agora: "No site agora",
} as const;
export type DetalheKind = keyof typeof DETALHES;

export const PERIODOS_DETALHE = [7, 28, 90] as const;
export type PeriodoDetalhe = (typeof PERIODOS_DETALHE)[number];

export function isDetalheKind(v: unknown): v is DetalheKind {
  return typeof v === "string" && v in DETALHES;
}
export function toPeriodoDetalhe(v: unknown): PeriodoDetalhe {
  const n = Number(v);
  return (PERIODOS_DETALHE as readonly number[]).includes(n)
    ? (n as PeriodoDetalhe)
    : 28;
}

/** Tipo de cada coluna — decide o alinhamento e a formatação no modal. */
export type ColunaTipo = "texto" | "numero" | "percentual" | "duracao" | "data";
export type DetalheSecao = {
  titulo: string;
  colunas: { rotulo: string; tipo: ColunaTipo }[];
  linhas: (string | number)[][];
  /** Linha discreta sob o título. */
  nota?: string;
};
export type AudienceDetail = {
  kind: DetalheKind;
  periodo: PeriodoDetalhe | null; // null = tempo real
  secoes: DetalheSecao[];
  fetchedAt: string;
};

async function fetchDetail(
  kind: DetalheKind,
  dias: PeriodoDetalhe,
): Promise<AudienceDetail> {
  const cfg = config();
  if (!cfg) throw new Error("Google Analytics não configurado");
  const dateRanges = [{ startDate: `${dias - 1}daysAgo`, endDate: "today" }];
  const agoraIso = new Date().toISOString();

  if (kind === "agora") {
    const tempoReal = (dimension: string, limit: number) =>
      gaPost<GaReport>(cfg, "runRealtimeReport", {
        dimensions: [{ name: dimension }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit,
      });
    const [telas, cidades, aparelhos] = await Promise.all([
      tempoReal("unifiedScreenName", 20),
      tempoReal("city", 15),
      tempoReal("deviceCategory", 5),
    ]);
    const tabela = (r: GaReport, map?: Record<string, string>) =>
      (r.rows ?? []).map((x) => [map?.[dim(x)] ?? dim(x), num(x)]);
    const duas = (rotulo: string) => [
      { rotulo, tipo: "texto" as const },
      { rotulo: "Visitantes", tipo: "numero" as const },
    ];
    return {
      kind,
      periodo: null,
      secoes: [
        {
          titulo: "Página em que estão",
          nota: "Últimos 30 minutos. O nome é o título da página.",
          colunas: duas("Página"),
          linhas: tabela(telas),
        },
        { titulo: "Cidade", colunas: duas("Cidade"), linhas: tabela(cidades) },
        {
          titulo: "Aparelho",
          colunas: duas("Aparelho"),
          linhas: tabela(aparelhos, APARELHOS),
        },
      ],
      fetchedAt: agoraIso,
    };
  }

  const porMetrica = (metricName: string) => [
    { metric: { metricName }, desc: true },
  ];
  const pedidos: Record<Exclude<DetalheKind, "agora">, object[]> = {
    visitantes: [
      {
        dateRanges,
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "activeUsers" },
          { name: "newUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
        ],
        orderBys: [{ dimension: { dimensionName: "date" }, desc: true }],
      },
      {
        dateRanges,
        dimensions: [{ name: "city" }, { name: "region" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: porMetrica("activeUsers"),
        limit: 25,
      },
    ],
    paginas: [
      {
        dateRanges,
        dimensions: [{ name: "pagePath" }],
        metrics: [
          { name: "screenPageViews" },
          { name: "activeUsers" },
          { name: "userEngagementDuration" },
        ],
        orderBys: porMetrica("screenPageViews"),
        limit: 50,
      },
      {
        dateRanges,
        dimensions: [{ name: "landingPage" }],
        metrics: [{ name: "sessions" }, { name: "bounceRate" }],
        orderBys: porMetrica("sessions"),
        limit: 20,
      },
    ],
    origens: [
      {
        dateRanges,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "engagementRate" },
        ],
        orderBys: porMetrica("sessions"),
      },
      {
        dateRanges,
        dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
        metrics: [{ name: "sessions" }],
        orderBys: porMetrica("sessions"),
        limit: 30,
      },
    ],
    aparelhos: [
      {
        dateRanges,
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "activeUsers" }, { name: "engagementRate" }],
        orderBys: porMetrica("activeUsers"),
      },
      {
        dateRanges,
        dimensions: [{ name: "operatingSystem" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: porMetrica("activeUsers"),
        limit: 10,
      },
      {
        dateRanges,
        dimensions: [{ name: "browser" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: porMetrica("activeUsers"),
        limit: 10,
      },
    ],
  };

  const { reports = [] } = await gaPost<{ reports?: GaReport[] }>(
    cfg,
    "batchRunReports",
    { requests: pedidos[kind] },
  );
  const linhas = (i: number) => reports[i]?.rows ?? [];
  const ymd = (v: string) =>
    v.length === 8 ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}` : v;

  let secoes: DetalheSecao[] = [];
  if (kind === "visitantes") {
    secoes = [
      {
        titulo: "Por dia",
        nota: "Dias sem nenhuma visita não aparecem.",
        colunas: [
          { rotulo: "Dia", tipo: "data" },
          { rotulo: "Visitantes", tipo: "numero" },
          { rotulo: "Novos", tipo: "numero" },
          { rotulo: "Sessões", tipo: "numero" },
          { rotulo: "Páginas vistas", tipo: "numero" },
        ],
        linhas: linhas(0).map((r) => [
          ymd(dim(r)),
          num(r, 0),
          num(r, 1),
          num(r, 2),
          num(r, 3),
        ]),
      },
      {
        titulo: "Cidades",
        nota: "As 25 com mais visitantes.",
        colunas: [
          { rotulo: "Cidade", tipo: "texto" },
          { rotulo: "Estado", tipo: "texto" },
          { rotulo: "Visitantes", tipo: "numero" },
        ],
        linhas: linhas(1).map((r) => [dim(r, 0), dim(r, 1), num(r)]),
      },
    ];
  } else if (kind === "paginas") {
    secoes = [
      {
        titulo: "Páginas mais vistas",
        nota: "As 50 mais vistas. Tempo médio é o tempo com a página aberta na tela, por visitante.",
        colunas: [
          { rotulo: "Página", tipo: "texto" },
          { rotulo: "Visualizações", tipo: "numero" },
          { rotulo: "Visitantes", tipo: "numero" },
          { rotulo: "Tempo médio", tipo: "duracao" },
        ],
        linhas: linhas(0).map((r) => {
          const usuarios = num(r, 1);
          return [
            dim(r),
            num(r, 0),
            usuarios,
            usuarios > 0 ? num(r, 2) / usuarios : 0,
          ];
        }),
      },
      {
        titulo: "Por onde entraram",
        nota: "A primeira página da visita. Rejeição é quem saiu sem interagir.",
        colunas: [
          { rotulo: "Página de entrada", tipo: "texto" },
          { rotulo: "Sessões", tipo: "numero" },
          { rotulo: "Rejeição", tipo: "percentual" },
        ],
        linhas: linhas(1).map((r) => [dim(r), num(r, 0), num(r, 1)]),
      },
    ];
  } else if (kind === "origens") {
    secoes = [
      {
        titulo: "Canal",
        nota: "Engajamento é a parte das visitas com 10 s ou mais, ou 2 páginas ou mais.",
        colunas: [
          { rotulo: "Canal", tipo: "texto" },
          { rotulo: "Sessões", tipo: "numero" },
          { rotulo: "Visitantes", tipo: "numero" },
          { rotulo: "Engajamento", tipo: "percentual" },
        ],
        linhas: linhas(0).map((r) => [
          CANAIS[dim(r)] ?? dim(r),
          num(r, 0),
          num(r, 1),
          num(r, 2),
        ]),
      },
      {
        titulo: "Origem detalhada",
        nota: "Site e meio de onde a visita veio, por exemplo instagram.com e referral.",
        colunas: [
          { rotulo: "Origem", tipo: "texto" },
          { rotulo: "Meio", tipo: "texto" },
          { rotulo: "Sessões", tipo: "numero" },
        ],
        linhas: linhas(1).map((r) => [dim(r, 0), dim(r, 1), num(r)]),
      },
    ];
  } else {
    secoes = [
      {
        titulo: "Tipo de aparelho",
        colunas: [
          { rotulo: "Aparelho", tipo: "texto" },
          { rotulo: "Visitantes", tipo: "numero" },
          { rotulo: "Engajamento", tipo: "percentual" },
        ],
        linhas: linhas(0).map((r) => [
          APARELHOS[dim(r)] ?? dim(r),
          num(r, 0),
          num(r, 1),
        ]),
      },
      {
        titulo: "Sistema",
        colunas: [
          { rotulo: "Sistema", tipo: "texto" },
          { rotulo: "Visitantes", tipo: "numero" },
        ],
        linhas: linhas(1).map((r) => [dim(r), num(r)]),
      },
      {
        titulo: "Navegador",
        nota: "Safari (in-app) e Android Webview costumam ser o navegador de dentro do Instagram.",
        colunas: [
          { rotulo: "Navegador", tipo: "texto" },
          { rotulo: "Visitantes", tipo: "numero" },
        ],
        linhas: linhas(2).map((r) => [dim(r), num(r)]),
      },
    ];
  }

  return { kind, periodo: dias, secoes, fetchedAt: agoraIso };
}

const cachedDetail = unstable_cache(fetchDetail, ["ga-detalhe"], {
  revalidate: 900,
});
const cachedDetailAgora = unstable_cache(fetchDetail, ["ga-detalhe-agora"], {
  revalidate: 60,
});

export type AudienceDetailResult =
  | { status: "ok"; data: AudienceDetail }
  | { status: "unconfigured" }
  | { status: "error"; message: string };

/** Detalhe de um card. Nunca lança (mesmo contrato de `getAudience`). */
export async function getAudienceDetail(
  kind: DetalheKind,
  periodo: PeriodoDetalhe,
): Promise<AudienceDetailResult> {
  if (!analyticsConfigured()) return { status: "unconfigured" };
  try {
    const data =
      kind === "agora"
        ? await cachedDetailAgora(kind, 28)
        : await cachedDetail(kind, periodo);
    return { status: "ok", data };
  } catch (e) {
    console.error("[analytics] detalhe do Google Analytics falhou", e);
    return {
      status: "error",
      message: e instanceof Error ? e.message : "erro desconhecido",
    };
  }
}
