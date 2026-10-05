import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { displayProductName } from "@/lib/product-name";
import {
  ACOES_AUTOMATICAS,
  acaoConhecida,
  acaoInfo,
  acoesDaArea,
  acoesForaDe,
  acoesQueCasam,
  eventoAutomatico,
  fraseDoEvento,
  type Area,
} from "@/lib/audit-labels";

/**
 * Leituras do Registro de atividades (`/admin/logs`). Tudo via service_role —
 * o `audit_log` não tem policy de leitura —, então só se chama daqui DEPOIS do
 * `requireAdmin()` da página.
 *
 * Filtro, período e paginação rodam NO BANCO: o log cresce a cada cotação de
 * frete e a cada código enviado, e trazer tudo para filtrar em memória ficaria
 * mais caro a cada semana.
 */

export const LOGS_POR_PAGINA = 100;

export const PERIODOS = {
  hoje: "Hoje",
  "7": "7 dias",
  "30": "30 dias",
  "90": "90 dias",
  tudo: "Tudo",
} as const;
export type Periodo = keyof typeof PERIODOS;
export const PERIODO_PADRAO: Periodo = "7";

export function isPeriodo(v: unknown): v is Periodo {
  return typeof v === "string" && v in PERIODOS;
}

export type AuditFiltros = {
  area: Area | null;
  /** E-mail de quem fez, ou "auto" para os eventos sem pessoa. */
  quem: string | null;
  periodo: Periodo;
  busca: string;
  /** Mostrar os automáticos (cotação, e-mail enviado, freios). */
  auto: boolean;
  pagina: number;
};

/** Evento já traduzido — o desenho só exibe, não interpreta código. */
export type AuditEvento = {
  id: number;
  createdAt: string;
  action: string;
  acaoConhecida: boolean;
  area: Area;
  automatico: boolean;
  frase: string;
  /** Nome curto de quem fez; `null` = automático. */
  quemNome: string | null;
  quemEmail: string | null;
  /** Pessoa da equipe (está em `admins`) — os demais são clientes. */
  equipe: boolean;
  item: string | null;
  itemHref: string | null;
  ip: string | null;
  metadata: Record<string, unknown>;
};

export type AuditEventoDetalhe = AuditEvento & { userAgent: string | null };

export type AuditPessoa = { email: string; nome: string; equipe: boolean };

type Row = {
  id: number;
  created_at: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  metadata: unknown;
  ip: string | null;
  user_agent?: string | null;
};

const COLUNAS =
  "id, created_at, actor_id, actor_email, action, entity_type, entity_id, entity_label, metadata, ip";

/** Início do período em ISO. "Hoje" é o dia de Brasília: o Brasil não tem
 * horário de verão desde 2019, então meia-noite local é sempre 03:00 UTC. */
function inicioDoPeriodo(p: Periodo): string | null {
  if (p === "tudo") return null;
  if (p === "hoje") {
    const dia = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
    }).format(new Date());
    return new Date(`${dia}T00:00:00-03:00`).toISOString();
  }
  return new Date(Date.now() - Number(p) * 86_400_000).toISOString();
}

/** Tira o que tem significado na sintaxe do `or()` do PostgREST — a busca
 * vai crua para dentro do filtro. */
function limparBusca(s: string): string {
  return s.replace(/[,()*%\\:"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

const comoObjeto = (m: unknown): Record<string, unknown> =>
  m && typeof m === "object" && !Array.isArray(m)
    ? (m as Record<string, unknown>)
    : {};

/** user_id → nome completo, para "Gabriel" em vez do e-mail. */
async function nomesDaEquipe(): Promise<Map<string, string>> {
  const { data } = await createAdminClient()
    .from("admins")
    .select("user_id, full_name");
  return new Map(
    (data ?? []).map((a) => [a.user_id, a.full_name?.trim() || ""]),
  );
}

const primeiroNome = (nome: string) => nome.split(/\s+/)[0] ?? nome;
const doEmail = (email: string) => email.split("@")[0] ?? email;

/**
 * Traduz as linhas de uma página. Muitas ações gravam só o id do item (estoque,
 * foto, avanço de pedido): o nome do produto, o número do pedido e a cor saem
 * de UMA consulta por tabela para a página inteira — nunca uma por linha.
 */
async function traduzir(rows: Row[]): Promise<AuditEvento[]> {
  const admin = createAdminClient();
  const prodIds = new Set<string>();
  const pedidoIds = new Set<string>();
  const pcIds = new Set<string>();
  const corIds = new Set<string>();
  for (const r of rows) {
    const m = comoObjeto(r.metadata);
    if (r.entity_type === "product" && r.entity_id) prodIds.add(r.entity_id);
    if (r.entity_type === "order" && r.entity_id && !r.entity_label)
      pedidoIds.add(r.entity_id);
    if (typeof m.productColorId === "string") pcIds.add(m.productColorId);
    if (typeof m.colorId === "string") corIds.add(m.colorId);
  }
  const uuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
  const lista = (s: Set<string>) => [...s].filter(uuid);

  const [equipe, produtos, pedidos, pcs, cores] = await Promise.all([
    nomesDaEquipe(),
    lista(prodIds).length
      ? admin.from("products").select("id, name").in("id", lista(prodIds))
      : null,
    lista(pedidoIds).length
      ? admin.from("orders").select("id, number").in("id", lista(pedidoIds))
      : null,
    lista(pcIds).length
      ? admin
          .from("product_colors")
          .select("id, colors(name)")
          .in("id", lista(pcIds))
      : null,
    lista(corIds).length
      ? admin.from("colors").select("id, name").in("id", lista(corIds))
      : null,
  ]);
  const nomeProduto = new Map(
    (produtos?.data ?? []).map((p) => [p.id, displayProductName(p.name)]),
  );
  const numeroPedido = new Map(
    (pedidos?.data ?? []).map((p) => [p.id, p.number as number]),
  );
  const corDoPc = new Map(
    ((pcs?.data ?? []) as unknown as {
      id: string;
      colors: { name: string } | null;
    }[]).map((p) => [p.id, p.colors?.name ?? null]),
  );
  const nomeCor = new Map(
    (cores?.data ?? []).map((c) => [c.id, c.name as string]),
  );

  return rows.map((r) => {
    const meta = comoObjeto(r.metadata);
    const ehEquipe = Boolean(r.actor_id && equipe.has(r.actor_id));
    const nomeCompleto = r.actor_id ? equipe.get(r.actor_id) : undefined;
    const quemNome = r.actor_email
      ? nomeCompleto
        ? primeiroNome(nomeCompleto)
        : ehEquipe
          ? doEmail(r.actor_email)
          : r.actor_email
      : null;

    let item = r.entity_label;
    let itemHref: string | null = null;
    if (r.entity_type === "product" && r.entity_id) {
      // O nome ATUAL do produto vale mais que o rótulo gravado (que nem
      // existe em estoque/foto). Produto excluído fica com o que foi gravado.
      item =
        nomeProduto.get(r.entity_id) ??
        (item ? displayProductName(item) : item);
      if (nomeProduto.has(r.entity_id))
        itemHref = `/admin/produtos/${r.entity_id}`;
    }
    if (r.entity_type === "order") {
      const n =
        (r.entity_id && numeroPedido.get(r.entity_id)) ||
        Number(/(\d+)/.exec(r.entity_label ?? "")?.[1] ?? NaN);
      if (Number.isFinite(n) && n > 0) {
        item = `nº ${n}`;
        itemHref = `/admin/pedidos?pedido=${n}`;
      }
    }
    const cor =
      (typeof meta.productColorId === "string" &&
        corDoPc.get(meta.productColorId)) ||
      (typeof meta.colorId === "string" && nomeCor.get(meta.colorId)) ||
      null;

    const info = acaoInfo(r.action);
    return {
      id: r.id,
      createdAt: r.created_at,
      action: r.action,
      acaoConhecida: acaoConhecida(r.action),
      area: info.area,
      automatico: eventoAutomatico(r.action, r.entity_type),
      frase: fraseDoEvento(r.action, { quem: quemNome, item, cor, meta }),
      quemNome,
      quemEmail: r.actor_email,
      equipe: ehEquipe,
      item,
      itemHref,
      ip: r.ip,
      metadata: meta,
    };
  });
}

/** Uma página do registro, já filtrada no banco. */
export async function getAuditLog(
  f: AuditFiltros,
): Promise<{ eventos: AuditEvento[]; total: number }> {
  const admin = createAdminClient();
  const de = (f.pagina - 1) * LOGS_POR_PAGINA;
  let q = admin
    .from("audit_log")
    .select(COLUNAS, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(de, de + LOGS_POR_PAGINA - 1);

  const desde = inicioDoPeriodo(f.periodo);
  if (desde) q = q.gte("created_at", desde);

  if (f.area === "sistema") {
    // Sistema também recolhe as ações que ninguém cadastrou em audit-labels.
    q = q.not("action", "in", `(${acoesForaDe("sistema").join(",")})`);
  } else if (f.area) {
    q = q.in("action", acoesDaArea(f.area));
  }

  if (f.quem === "auto") q = q.is("actor_email", null);
  else if (f.quem) q = q.eq("actor_email", f.quem);

  if (!f.auto) {
    q = q
      .not("action", "in", `(${ACOES_AUTOMATICAS.join(",")})`)
      // `neq` sozinho descartaria entity_type nulo (NULL <> 'rate' não é true).
      .or("entity_type.is.null,entity_type.neq.rate");
  }

  const termo = limparBusca(f.busca);
  if (termo) {
    const alvos = [
      `entity_label.ilike.%${termo}%`,
      `actor_email.ilike.%${termo}%`,
      `action.ilike.%${termo}%`,
    ];
    const acoes = acoesQueCasam(termo);
    if (acoes.length) alvos.push(`action.in.(${acoes.join(",")})`);
    // "1007" acha também os eventos do pedido que só gravaram o id dele.
    const numero = termo.replace(/^n[º°o.]?\s*/i, "");
    if (/^\d{1,9}$/.test(numero)) {
      const { data } = await admin
        .from("orders")
        .select("id")
        .eq("number", Number(numero))
        .maybeSingle();
      if (data) alvos.push(`entity_id.eq.${data.id}`);
    }
    q = q.or(alvos.join(","));
  }

  const { data, count, error } = await q;
  if (error || !data) return { eventos: [], total: 0 };
  return { eventos: await traduzir(data as unknown as Row[]), total: count ?? 0 };
}

/** Um evento só, para o modal de detalhe (`?evento=<id>`). */
export async function getAuditEvent(
  id: number,
): Promise<AuditEventoDetalhe | null> {
  const { data } = await createAdminClient()
    .from("audit_log")
    .select(`${COLUNAS}, user_agent`)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Row;
  const [evento] = await traduzir([row]);
  return { ...evento, userAgent: row.user_agent ?? null };
}

/**
 * Quem aparece no log, para o filtro "Quem". Lê só a coluna do e-mail dos
 * eventos com pessoa — os automáticos (a maioria das linhas) ficam de fora.
 */
export async function getAuditPessoas(): Promise<AuditPessoa[]> {
  const admin = createAdminClient();
  const [{ data }, equipe] = await Promise.all([
    admin
      .from("audit_log")
      .select("actor_id, actor_email")
      .not("actor_email", "is", null)
      .order("created_at", { ascending: false })
      .limit(5000),
    nomesDaEquipe(),
  ]);
  const vistos = new Map<string, AuditPessoa>();
  for (const r of data ?? []) {
    if (!r.actor_email || vistos.has(r.actor_email)) continue;
    const ehEquipe = Boolean(r.actor_id && equipe.has(r.actor_id));
    const nome = (r.actor_id && equipe.get(r.actor_id)) || "";
    vistos.set(r.actor_email, {
      email: r.actor_email,
      nome: nome || (ehEquipe ? doEmail(r.actor_email) : r.actor_email),
      equipe: ehEquipe,
    });
  }
  return [...vistos.values()].sort(
    (a, b) => Number(b.equipe) - Number(a.equipe) || a.nome.localeCompare(b.nome),
  );
}
