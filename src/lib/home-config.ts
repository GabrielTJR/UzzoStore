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
import { HOME_HERO, type HeroTag, type PosEtiqueta } from "@/lib/home-hero";
import { FRETE_GRATIS_MIN } from "@/lib/shipping-config";
import { formatBRL } from "@/lib/format";
import type { CategoryCoversByDepartment } from "@/lib/products";

export type { HeroTag, PosEtiqueta };

export type HeroLook = { name: string; slug: string };

/** Os dois formatos do hero: celular (foto = tela inteira) e computador (foto
 * na metade direita). Cada um tem enquadramento e etiquetas próprios. */
export type Formato = "cel" | "pc";

/** Enquadramento: qual parte da foto fica à vista quando ela é cortada para
 * cobrir a área — 0 = borda esquerda/topo, 100 = direita/pé. */
export type Foco = { fx: number; fy: number };

/** Foto própria do computador (opcional — sem ela, vale a do celular). */
export type HeroFotoPc = { image: string; alt: string; ratio: number };

export type HeroConfig = {
  image: string;
  alt: string;
  /** Largura ÷ altura da foto — o editor mede ao carregar. É o que faz as
   * etiquetas (em % da foto) caírem no lugar certo. */
  ratio: number;
  focoCel: Foco;
  focoPc: Foco;
  fotoPc: HeroFotoPc | null;
  title: string;
  text: string;
  /** Peça da foto ("Na foto: …"). `null` esconde a linha. */
  look: HeroLook | null;
  tags: HeroTag[];
};

/**
 * Proporção (largura ÷ altura) da área da foto no pior caso de cada formato —
 * é com ela que o editor desenha a faixa que SEMPRE aparece. Celular: a área
 * é a tela menos cabeçalho e faixa de avisos; nos aparelhos mais altos fica
 * perto de 0,5. Computador: a metade direita da tela chega a ~1,05 em telas
 * baixas (1280 × 720).
 */
export const PROPORCAO_AREA: Record<Formato, number> = { cel: 0.5, pc: 1.05 };

/** Proporção da foto a usar num formato (o computador pode ter foto própria). */
export function ratioDoFormato(h: HeroConfig, f: Formato): number {
  return f === "pc" && h.fotoPc ? h.fotoPc.ratio : h.ratio;
}

/**
 * A parte da foto que aparece numa área de proporção `area`, com o
 * enquadramento `foco` — em % da foto. Espelha a conta do `.hero-caixa`.
 */
export function faixaVisivel(
  ratio: number,
  area: number,
  foco: Foco,
): { x0: number; x1: number; y0: number; y1: number } {
  if (area < ratio) {
    // Área mais estreita que a foto: corta dos lados.
    const w = (area / ratio) * 100;
    const x0 = (100 - w) * (foco.fx / 100);
    return { x0, x1: x0 + w, y0: 0, y1: 100 };
  }
  // Área mais larga: corta em cima/embaixo.
  const h = (ratio / area) * 100;
  const y0 = (100 - h) * (foco.fy / 100);
  return { x0: 0, x1: 100, y0, y1: y0 + h };
}

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

/**
 * A home de antes do editor. É o que a loja mostra sem a migração 0023, sem
 * nada publicado, ou quando a leitura falha — a loja nunca fica sem home.
 */
export const DEFAULT_HOME_CONFIG: HomeConfig = {
  hero: {
    image: HOME_HERO.image,
    alt: HOME_HERO.alt,
    ratio: HOME_HERO.ratio,
    focoCel: { fx: 50, fy: 12 },
    focoPc: { fx: 50, fy: 12 },
    fotoPc: null,
    title: HOME_HERO.title,
    text: HOME_HERO.text,
    look: HOME_HERO.look,
    tags: HOME_HERO.tags,
  },
  avisos: [
    { id: "frete", text: "", active: true, auto: "frete" },
    { id: "parcelas", text: "3x sem juros no cartão", active: true },
    { id: "troca", text: "Troca em até 30 dias", active: true },
    {
      id: "retirada",
      text: "Retire na loja em Balneário Camboriú",
      active: true,
    },
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
  return typeof v === "string"
    ? v.replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function pct(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;
}

/** Proporção de foto plausível (de panorâmica 3:1 a retrato 1:3). */
function ratioOk(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0.33 || n > 3) return null;
  return Math.round(n * 10000) / 10000;
}

function normalizeFoco(raw: unknown, fallback: Foco): Foco {
  if (!raw || typeof raw !== "object") return fallback;
  const f = raw as Record<string, unknown>;
  return { fx: pct(f.fx) ?? fallback.fx, fy: pct(f.fy) ?? fallback.fy };
}

function normalizePos(raw: unknown): PosEtiqueta | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const x = pct(p.x);
  const y = pct(p.y);
  const lx = pct(p.lx);
  const ly = pct(p.ly);
  if (x == null || y == null || lx == null || ly == null) return null;
  return { x, y, lx, ly, lado: p.lado === "e" ? "e" : "d" };
}

/**
 * Etiqueta gravada ANTES da tela inteira (out/2026): posições em % de uma
 * moldura 4:5 recortada da foto (`object-position: 50% focoY%`). Converte o
 * ponto para % da foto e recoloca o rótulo com a regra nova. No celular, a de
 * baixo some (cairia sob o título) — o dono revê no editor.
 */
function tagAntiga(
  t: Record<string, unknown>,
  ratio: number,
  focoY: number,
): Pick<HeroTag, "cel" | "pc"> | null {
  const x = pct(t.x);
  const y = pct(t.y);
  if (x == null || y == null) return null;
  const MOLDURA = 0.8;
  let px = x;
  let py = y;
  if (ratio <= MOLDURA) {
    const hMoldura = 1 / MOLDURA; // alturas em unidades da largura
    const hFoto = 1 / ratio;
    const desloca = (hFoto - hMoldura) * (focoY / 100);
    py = ((desloca + (y / 100) * hMoldura) / hFoto) * 100;
  } else {
    const wMoldura = MOLDURA / ratio; // larguras em unidades da largura da foto
    px = ((1 - wMoldura) / 2 + (x / 100) * wMoldura) * 100;
  }
  const r = (t.rotulo ?? {}) as Record<string, unknown>;
  const direita =
    typeof r.right === "string" || parseFloat(String(r.left ?? "0")) >= 50;
  const lado = direita ? "d" : "e";
  return {
    cel: py > 58 ? null : posicionaRotulo(px, py, lado, "cel"),
    pc: posicionaRotulo(px, py, lado, "pc"),
  };
}

function normalizeTag(
  raw: unknown,
  ratio: number,
  focoY: number,
): HeroTag | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const label = texto(t.label, LIMITES.etiqueta);
  if (!label) return null;
  if ("cel" in t || "pc" in t) {
    const cel = normalizePos(t.cel);
    const pc = normalizePos(t.pc);
    return { label, cel, pc };
  }
  const antiga = tagAntiga(t, ratio, focoY);
  return antiga ? { label, ...antiga } : null;
}

function normalizeFotoPc(raw: unknown): HeroFotoPc | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Record<string, unknown>;
  const image = imagemDaLoja(f.image);
  const ratio = ratioOk(f.ratio);
  if (!image || !ratio) return null;
  return { image, ratio, alt: texto(f.alt, LIMITES.alt) };
}

function normalizeHero(raw: unknown): HeroConfig {
  const d = DEFAULT_HOME_CONFIG.hero;
  if (!raw || typeof raw !== "object") return d;
  const h = raw as Record<string, unknown>;
  const look = (h.look ?? null) as Record<string, unknown> | null;
  const lookName = look ? texto(look.name, 120) : "";
  const lookSlug =
    look &&
    typeof look.slug === "string" &&
    /^[a-z0-9-]{1,120}$/.test(look.slug)
      ? look.slug
      : "";
  const image = imagemDaLoja(h.image);
  // Configuração antiga não tem proporção: a foto de fábrica é 3:4, e o
  // editor mede a real assim que a foto carrega.
  const ratio =
    ratioOk(h.ratio) ?? (image === d.image || !image ? d.ratio : 0.75);
  // Antes era um número só (`focoY`, vertical na moldura 4:5).
  const focoAntigo = pct(h.focoY);
  const fb: Foco = { fx: 50, fy: focoAntigo ?? 12 };
  const tags = (Array.isArray(h.tags) ? h.tags : [])
    .map((t) => normalizeTag(t, ratio, focoAntigo ?? 12))
    .filter((t): t is HeroTag => !!t)
    .slice(0, MAX_ETIQUETAS);
  return {
    image: image ?? d.image,
    // Foto trocada sem descrição não herda o texto da foto de fábrica.
    alt: texto(h.alt, LIMITES.alt) || (image && image !== d.image ? "" : d.alt),
    ratio,
    focoCel: normalizeFoco(h.focoCel, fb),
    focoPc: normalizeFoco(h.focoPc, fb),
    fotoPc: normalizeFotoPc(h.fotoPc),
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
      typeof a.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(a.id)
        ? a.id
        : "";
    if (!id || vistos.has(id)) continue;
    const auto = a.auto === "frete" ? ("frete" as const) : undefined;
    // Só pode existir UMA mensagem automática de frete.
    if (auto && out.some((o) => o.auto)) continue;
    const text = auto ? "" : texto(a.text, LIMITES.aviso);
    if (!auto && !text) continue;
    vistos.add(id);
    out.push({
      id,
      text,
      active: a.active !== false,
      ...(auto ? { auto } : {}),
    });
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
    for (const [id, url] of Object.entries(
      a.fotos as Record<string, unknown>,
    )) {
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
  return {
    masculino: arruma(covers.masculino),
    feminino: arruma(covers.feminino),
  };
}

/* ------------------------------------------------------------------ */
/* Etiquetas: posição automática do rótulo                             */
/* ------------------------------------------------------------------ */

/**
 * Quando o dono move o ponto (ou troca o lado), o rótulo se recoloca sozinho:
 * a linha sai inclinada do ponto — para cima na metade de cima da foto, para
 * baixo na de baixo, para não cruzar o próprio texto — e o rótulo encosta na
 * ponta da linha, crescendo para o lado escolhido.
 *
 * O afastamento é MENOR no celular: lá aparece só a faixa do meio da foto
 * (ver `faixaVisivel`), e um rótulo longe do ponto sairia da tela.
 */
export function posicionaRotulo(
  x: number,
  y: number,
  lado: "e" | "d",
  formato: Formato,
): PosEtiqueta {
  const px = pct(x) ?? 50;
  const py = pct(y) ?? 50;
  const dx = formato === "cel" ? 9 : 14;
  const lx = Math.min(96, Math.max(4, lado === "d" ? px + dx : px - dx));
  const ly = Math.min(96, Math.max(4, py < 50 ? py - 8 : py + 6));
  return {
    x: px,
    y: py,
    lx: Math.round(lx * 10) / 10,
    ly: Math.round(ly * 10) / 10,
    lado,
  };
}
