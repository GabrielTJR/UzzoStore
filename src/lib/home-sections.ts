/**
 * Decoração da home: blocos tipados que o admin edita em /admin/decoracao.
 * O conteúdo de cada tipo vive em `data` (jsonb) — este módulo normaliza esse
 * jsonb em tipos seguros (nunca confie no formato do banco vindo de UI antiga).
 */

export type HomeSectionKind = "aviso" | "banner" | "mosaico" | "vitrine";

export type BannerSlide = {
  imageDesktop: string | null;
  imageMobile: string | null;
  title: string | null;
  subtitle: string | null;
  buttonLabel: string | null;
  buttonHref: string | null;
  align: "left" | "center" | "right";
  theme: "light" | "dark"; // cor do texto sobre a foto
};

export type MosaicCard = {
  image: string | null;
  label: string;
  href: string;
};

export type VitrineSource = "destaques" | "promo" | "categoria";

export type HomeSectionData = {
  // aviso
  text?: string | null;
  href?: string | null;
  // banner
  slides?: BannerSlide[];
  // mosaico / vitrine
  title?: string | null;
  cards?: MosaicCard[];
  source?: VitrineSource;
  categoryId?: string | null;
  limit?: number | null;
};

export type HomeSection = {
  id: string;
  kind: HomeSectionKind;
  /** Nome dado pelo admin — só identifica o bloco no painel, não vai à loja. */
  name: string;
  active: boolean;
  sortOrder: number;
  data: HomeSectionData;
};

const KINDS: HomeSectionKind[] = ["aviso", "banner", "mosaico", "vitrine"];

export function isHomeSectionKind(v: unknown): v is HomeSectionKind {
  return typeof v === "string" && (KINDS as string[]).includes(v);
}

/** Rótulo amigável do tipo (usado no admin). */
export const KIND_LABEL: Record<HomeSectionKind, string> = {
  aviso: "Faixa de aviso",
  banner: "Banner principal",
  mosaico: "Mosaico de coleções",
  vitrine: "Vitrine de produtos",
};

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function align(v: unknown): BannerSlide["align"] {
  return v === "center" || v === "right" ? v : "left";
}

function theme(v: unknown): BannerSlide["theme"] {
  return v === "dark" ? "dark" : "light";
}

function toSlides(v: unknown): BannerSlide[] {
  if (!Array.isArray(v)) return [];
  return (
    v
      .map((raw) => {
        const s = (raw ?? {}) as Record<string, unknown>;
        return {
          imageDesktop: str(s.imageDesktop),
          imageMobile: str(s.imageMobile),
          title: str(s.title),
          subtitle: str(s.subtitle),
          buttonLabel: str(s.buttonLabel),
          buttonHref: str(s.buttonHref),
          align: align(s.align),
          theme: theme(s.theme),
        };
      })
      // Slide sem NENHUMA imagem não vira banner (renderizaria um quadro vazio,
      // ou texto sem contraste). O texto sozinho não sustenta o bloco.
      .filter((s) => s.imageDesktop || s.imageMobile)
  );
}

function toCards(v: unknown): MosaicCard[] {
  if (!Array.isArray(v)) return [];
  return v.map((raw) => {
    const c = (raw ?? {}) as Record<string, unknown>;
    return {
      image: str(c.image),
      label: str(c.label) ?? "",
      href: str(c.href) ?? "/produtos",
    };
  });
}

function source(v: unknown): VitrineSource {
  return v === "promo" || v === "categoria" ? v : "destaques";
}

/** Normaliza a linha do banco num HomeSection tipado. */
export function toHomeSection(row: {
  id: string;
  kind: string;
  name?: string | null;
  active: boolean;
  sort_order: number;
  data: unknown;
}): HomeSection | null {
  if (!isHomeSectionKind(row.kind)) return null;
  const d = (row.data ?? {}) as Record<string, unknown>;
  const data: HomeSectionData = {};

  if (row.kind === "aviso") {
    data.text = str(d.text);
    data.href = str(d.href);
  } else if (row.kind === "banner") {
    data.slides = toSlides(d.slides);
  } else if (row.kind === "mosaico") {
    data.title = str(d.title);
    data.cards = toCards(d.cards);
  } else {
    data.title = str(d.title);
    data.source = source(d.source);
    data.categoryId = str(d.categoryId);
    const n = Number(d.limit);
    data.limit = Number.isFinite(n) && n > 0 ? Math.min(n, 12) : null;
  }

  return {
    id: row.id,
    kind: row.kind,
    name: str(row.name) ?? KIND_LABEL[row.kind],
    active: row.active,
    sortOrder: row.sort_order,
    data,
  };
}

/** Um bloco só é exibível se tiver conteúdo de fato. */
export function sectionHasContent(s: HomeSection): boolean {
  if (s.kind === "aviso") return !!s.data.text;
  // `toSlides` já descartou slides sem imagem (inclusive os só-mobile são válidos).
  if (s.kind === "banner") return (s.data.slides ?? []).length > 0;
  if (s.kind === "mosaico")
    return (s.data.cards ?? []).some((c) => c.image || c.label);
  // Vitrine de categoria sem categoria escolhida mostraria o catálogo inteiro.
  if (s.data.source === "categoria") return !!s.data.categoryId;
  return true;
}
