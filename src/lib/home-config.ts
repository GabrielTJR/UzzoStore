/**
 * Página inicial editável — o formato da configuração, os valores de fábrica e
 * as funções puras que a loja E o editor usam.
 *
 * Módulo NEUTRO (sem imports de servidor): o editor do painel é client
 * component e precisa normalizar e "resolver" a configuração para a prévia com
 * as MESMAS funções da loja — se a prévia tivesse lógica própria, ela
 * divergiria da loja no primeiro ajuste. A leitura do banco fica em
 * `home-config-server.ts`.
 *
 * Três partes:
 *   - `hero`: o destaque principal ("Etiqueta") — foto, enquadramento,
 *     etiquetas, título, texto e a peça do "Na foto";
 *   - `avisos`: as mensagens da faixa preta do topo;
 *   - `atalhos`: quais categorias aparecem na fileira da home, em que ordem e
 *     com que foto.
 *
 * Nunca confie no jsonb cru (`normalizeHomeConfig`): ele pode ter vindo de uma
 * versão antiga do editor, ou de alguém mexendo no SQL Editor. Cada campo
 * inválido cai no valor de fábrica, não derruba a home.
 */
import { HOME_HERO, type HeroTag } from "@/lib/home-hero";
import { FRETE_GRATIS_MIN } from "@/lib/shipping-config";
import { formatBRL } from "@/lib/format";
import type { CategoryCoversByDepartment } from "@/lib/products";

export type { HeroTag };

export type HeroLook = { name: string; slug: string };

export type HeroConfig = {
  image: string;
  alt: string;
  /** Enquadramento vertical da foto na moldura 4:5, em % (0 = topo). */
  focoY: number;
  title: string;
  text: string;
  /** Peça da foto ("Na foto: …"). `null` esconde a linha. */
  look: HeroLook | null;
  tags: HeroTag[];
};

/**
 * Mensagem da faixa. `auto: "frete"` é a mensagem de frete, que o EDITOR não
 * escreve: com a cotação do Melhor Envio ligada ela diz "Frete grátis acima de
 * R$ X"; sem a cotação, o frete é combinado pelo WhatsApp e não há mínimo para
 * prometer, então ela vira "Enviamos para todo o Brasil". O dono pode mudá-la
 * de lugar ou desligá-la, mas não reescrevê-la — a promessa tem que seguir o
 * que o site cumpre, não o que foi digitado um dia.
 */
export type AvisoConfig = {
  id: string;
  text: string;
  active: boolean;
  auto?: "frete";
};

export type AtalhosConfig = {
  /** Ids de categoria na ordem escolhida. As que não estão aqui vêm depois, na ordem automática. */
  ordem: string[];
  /** Ids de categoria escondidas da fileira (continuam no menu). */
  ocultas: string[];
  /** Foto escolhida por categoria (id → URL). Sem escolha, vale a automática. */
  fotos: Record<string, string>;
};

export type HomeConfig = {
  hero: HeroConfig;
  avisos: AvisoConfig[];
  atalhos: AtalhosConfig;
};

/** Uma foto cadastrada de produto, para os seletores do editor. */
export type ProductPhoto = {
  url: string;
  productId: string;
  productName: string;
  slug: string | null;
  categoryId: string | null;
  color: string | null;
  active: boolean;
};

/** Limites do editor (e da normalização). */
export const MAX_ETIQUETAS = 4;
export const MAX_AVISOS = 6;
export const LIMITES = {
  etiqueta: 32,
  titulo: 80,
  texto: 220,
  alt: 160,
  aviso: 70,
} as const;

/** "50% 12%" de `home-hero.ts` → 12. */
function focoDe(objectPosition: string): number {
  const m = /(\d+(?:\.\d+)?)%\s*$/.exec(objectPosition);
  return m ? Number(m[1]) : 50;
}

/**
 * A home de antes do editor. É o que a loja mostra sem a migração 0023, sem
 * nada publicado, ou quando a leitura falha — a loja nunca fica sem home.
 */
export const DEFAULT_HOME_CONFIG: HomeConfig = {
  hero: {
    image: HOME_HERO.image,
    alt: HOME_HERO.alt,
    focoY: focoDe(HOME_HERO.objectPosition),
    title: HOME_HERO.title,
    text: HOME_HERO.text,
    look: HOME_HERO.look,
    tags: HOME_HERO.tags,
  },
  avisos: [
    { id: "frete", text: "", active: true, auto: "frete" },
    { id: "parcelas", text: "3x sem juros no cartão", active: true },
    { id: "troca", text: "Troca em até 30 dias", active: true },
    { id: "retirada", text: "Retire na loja em Balneário Camboriú", active: true },
  ],
  atalhos: { ordem: [], ocultas: [], fotos: {} },
};

/* ------------------------------------------------------------------ */
/* Normalização                                                        */
/* ------------------------------------------------------------------ */

/**
 * Foto aceitável: URL pública do NOSSO bucket. Outra origem quebraria o
 * `next/image` (o `remotePatterns` só libera o host do Supabase) e seria porta
 * para pôr imagem de terceiro na vitrine.
 */
export function imagemDaLoja(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const prefixo = `${base.replace(/\/+$/, "")}/storage/v1/object/public/product-images/`;
  if (!v.startsWith(prefixo)) return null;
  const caminho = v.slice(prefixo.length);
  return /^[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+\.[A-Za-z0-9]+$/.test(caminho)
    ? v
    : null;
}

/** URL pública de um caminho do bucket (o upload devolve o caminho). */
export function urlDoCaminho(caminho: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/product-images/${caminho}`;
}

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function pct(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;
}

const PCT_CSS = /^\d{1,3}(?:\.\d{1,2})?%$/;

function normalizeTag(raw: unknown): HeroTag | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const label = texto(t.label, LIMITES.etiqueta);
  const x = pct(t.x);
  const y = pct(t.y);
  const tx = pct(t.tx);
  const ty = pct(t.ty);
  const r = (t.rotulo ?? {}) as Record<string, unknown>;
  const top = typeof r.top === "string" && PCT_CSS.test(r.top) ? r.top : null;
  const left = typeof r.left === "string" && PCT_CSS.test(r.left) ? r.left : null;
  const right =
    typeof r.right === "string" && PCT_CSS.test(r.right) ? r.right : null;
  if (!label || x == null || y == null || tx == null || ty == null || !top)
    return null;
  if (!left && !right) return null;
  return {
    label,
    x,
    y,
    tx,
    ty,
    rotulo: right ? { right, top } : { left: left!, top },
  };
}

function normalizeHero(raw: unknown): HeroConfig {
  const d = DEFAULT_HOME_CONFIG.hero;
  if (!raw || typeof raw !== "object") return d;
  const h = raw as Record<string, unknown>;
  const look = (h.look ?? null) as Record<string, unknown> | null;
  const lookName = look ? texto(look.name, 120) : "";
  const lookSlug =
    look && typeof look.slug === "string" && /^[a-z0-9-]{1,120}$/.test(look.slug)
      ? look.slug
      : "";
  const tags = (Array.isArray(h.tags) ? h.tags : [])
    .map(normalizeTag)
    .filter((t): t is HeroTag => !!t)
    .slice(0, MAX_ETIQUETAS);
  const image = imagemDaLoja(h.image);
  const focoY = pct(h.focoY);
  return {
    image: image ?? d.image,
    // Foto trocada sem descrição não herda o texto da foto de fábrica.
    alt: texto(h.alt, LIMITES.alt) || (image && image !== d.image ? "" : d.alt),
    focoY: focoY ?? d.focoY,
    title: texto(h.title, LIMITES.titulo) || d.title,
    text: texto(h.text, LIMITES.texto),
    look: lookName && lookSlug ? { name: lookName, slug: lookSlug } : null,
    // Lista vazia é escolha válida (foto sem etiqueta); lixo não.
    tags: Array.isArray(h.tags) ? tags : d.tags,
  };
}

function normalizeAvisos(raw: unknown): AvisoConfig[] {
  if (!Array.isArray(raw)) return DEFAULT_HOME_CONFIG.avisos;
  const vistos = new Set<string>();
  const out: AvisoConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const id =
      typeof a.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(a.id) ? a.id : "";
    if (!id || vistos.has(id)) continue;
    const auto = a.auto === "frete" ? ("frete" as const) : undefined;
    // Só pode existir UMA mensagem automática de frete.
    if (auto && out.some((o) => o.auto)) continue;
    const text = auto ? "" : texto(a.text, LIMITES.aviso);
    if (!auto && !text) continue;
    vistos.add(id);
    out.push({ id, text, active: a.active !== false, ...(auto ? { auto } : {}) });
    if (out.length >= MAX_AVISOS) break;
  }
  return out;
}

function ids(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [
    ...new Set(
      v.filter(
        (s): s is string =>
          typeof s === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(s),
      ),
    ),
  ].slice(0, 100);
}

function normalizeAtalhos(raw: unknown): AtalhosConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_HOME_CONFIG.atalhos;
  const a = raw as Record<string, unknown>;
  const fotos: Record<string, string> = {};
  if (a.fotos && typeof a.fotos === "object") {
    for (const [id, url] of Object.entries(a.fotos as Record<string, unknown>)) {
      const ok = imagemDaLoja(url);
      if (ok && /^[A-Za-z0-9_-]{1,64}$/.test(id)) fotos[id] = ok;
    }
  }
  return { ordem: ids(a.ordem), ocultas: ids(a.ocultas), fotos };
}

export function normalizeHomeConfig(raw: unknown): HomeConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_HOME_CONFIG;
  const c = raw as Record<string, unknown>;
  return {
    hero: normalizeHero(c.hero),
    avisos: normalizeAvisos(c.avisos),
    atalhos: normalizeAtalhos(c.atalhos),
  };
}

/* ------------------------------------------------------------------ */
/* Resolução (o que a loja mostra)                                     */
/* ------------------------------------------------------------------ */

/** O texto da mensagem automática de frete, conforme a cotação. */
export function textoAvisoFrete(freteAtivo: boolean): string {
  return freteAtivo && FRETE_GRATIS_MIN != null
    ? `Frete grátis acima de ${formatBRL(FRETE_GRATIS_MIN).replace(",00", "")}`
    : "Enviamos para todo o Brasil";
}

/** As mensagens LIGADAS, na ordem, com a de frete já resolvida. */
export function mensagensDaFaixa(
  avisos: AvisoConfig[],
  freteAtivo: boolean,
): string[] {
  return avisos
    .filter((a) => a.active)
    .map((a) => (a.auto === "frete" ? textoAvisoFrete(freteAtivo) : a.text))
    .filter(Boolean);
}

/**
 * Aplica a escolha do dono às capas automáticas: ordem, ocultas e foto.
 * Categoria nova (que ainda não está em `ordem`) aparece no fim, na ordem
 * automática — ela não some só porque o editor foi salvo antes de ela existir.
 * Categoria sem peça ativa já não vem nas capas, então não há como um atalho
 * levar para página vazia.
 */
export function aplicaAtalhos(
  covers: CategoryCoversByDepartment,
  atalhos: AtalhosConfig,
): CategoryCoversByDepartment {
  const pos = new Map(atalhos.ordem.map((id, i) => [id, i]));
  const ocultas = new Set(atalhos.ocultas);
  const arruma = (lista: CategoryCoversByDepartment["masculino"]) =>
    lista
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !ocultas.has(c.id))
      .sort((a, b) => {
        const pa = pos.get(a.c.id);
        const pb = pos.get(b.c.id);
        if (pa != null && pb != null) return pa - pb;
        if (pa != null) return -1;
        if (pb != null) return 1;
        return a.i - b.i;
      })
      .map(({ c }) => ({ ...c, image: atalhos.fotos[c.id] ?? c.image }));
  return { masculino: arruma(covers.masculino), feminino: arruma(covers.feminino) };
}

/* ------------------------------------------------------------------ */
/* Etiquetas: posição automática do rótulo                             */
/* ------------------------------------------------------------------ */

export type LadoRotulo = "esquerda" | "direita";

export function ladoDoRotulo(t: HeroTag): LadoRotulo {
  if (t.rotulo.right) return "direita";
  return parseFloat(t.rotulo.left ?? "0") >= 50 ? "direita" : "esquerda";
}

/**
 * Quando o dono move o ponto (ou troca o lado), o rótulo e a linha se
 * recalculam. O rótulo encosta na BORDA da moldura do lado escolhido (4%) — o
 * editor não sabe a largura do texto em cada tela, mas sabe que a linha que
 * termina a 8% da borda acaba DENTRO do rótulo, seja ele curto ou comprido, e
 * o rótulo (desenhado por cima) cobre a ponta. Na vertical, o rótulo fica um
 * pouco acima do ponto na metade de cima da foto e um pouco abaixo na metade
 * de baixo, para a linha sair inclinada e não cruzar o texto.
 *
 * As etiquetas de fábrica (posições afinadas à mão em `home-hero.ts`) só
 * passam por aqui se forem mexidas.
 */
export function posicionaEtiqueta(
  label: string,
  x: number,
  y: number,
  lado: LadoRotulo,
): HeroTag {
  const px = pct(x) ?? 50;
  const py = pct(y) ?? 50;
  const top = Math.round(Math.min(92, Math.max(2, py < 50 ? py - 12 : py + 7)));
  const ty = top + 2.5;
  return {
    label,
    x: px,
    y: py,
    tx: lado === "direita" ? 92 : 8,
    ty,
    rotulo:
      lado === "direita"
        ? { right: "4%", top: `${top}%` }
        : { left: "4%", top: `${top}%` },
  };
}
