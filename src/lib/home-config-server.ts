import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/products";
import { displayProductName } from "@/lib/product-name";
import {
  DEFAULT_HOME_CONFIG,
  normalizeHomeConfig,
  type HomeConfig,
  type ProductPhoto,
} from "@/lib/home-config";

/**
 * Leituras da configuração da página inicial (tabela `home_config`, migração
 * 0023). O formato e as funções puras moram em `home-config.ts`.
 */

/**
 * A tabela ainda não existe (migração 0023 não aplicada). O PostgREST responde
 * PGRST205 ("não achei a tabela no cache do schema"); o Postgres direto, 42P01.
 */
function tabelaAusente(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    (/home_config/.test(error.message ?? "") &&
      /does not exist|schema cache/i.test(error.message ?? ""))
  );
}

/**
 * A configuração PUBLICADA, como a loja a vê. Leitura pública (anon, sem
 * cookie) dentro do `unstable_cache` com a etiqueta da decoração: o Publicar
 * do painel chama `updateTag(decoracao)` e a loja muda na hora; sem
 * publicação, nenhuma visita toca o banco por causa disto.
 *
 * Sem a migração (tabela ausente) ou sem nada publicado, devolve `null` — e
 * ISSO é cacheado de propósito: "ainda não há editor" é estado estável, e não
 * cachear faria toda visita bater no banco só para ouvir "tabela não existe".
 * Quando o dono aplicar a migração e publicar, o `updateTag` derruba o cache.
 *
 * Erro DE VERDADE (banco fora, cota estourada) lança: nada é gravado no cache
 * e o chamador cai nos valores de fábrica — a mesma regra de
 * `semCachearFalha` em `products.ts`.
 */
const publishedCache = unstable_cache(
  async (): Promise<unknown | null> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("home_config")
      .select("data")
      .eq("slot", "publicado")
      .maybeSingle();
    if (error) {
      if (tabelaAusente(error)) return null;
      throw new Error(`home_config: ${error.message}`);
    }
    return data?.data ?? null;
  },
  ["home-config"],
  { revalidate: 3600, tags: [CACHE_TAGS.decoracao] },
);

/** Memoizada por requisição: o layout (faixa) e a home (hero, atalhos) dividem. */
export const getHomeConfig = cache(async (): Promise<HomeConfig> => {
  try {
    const raw = await publishedCache();
    return raw ? normalizeHomeConfig(raw) : DEFAULT_HOME_CONFIG;
  } catch (e) {
    console.error("[home] leitura da configuração falhou", e);
    return DEFAULT_HOME_CONFIG;
  }
});

/* ------------------------------------------------------------------ */
/* Só para o painel — NÃO cacheado (dado de admin não entra no cache    */
/* público, e o editor precisa ver o que acabou de salvar).             */
/* ------------------------------------------------------------------ */

export type HomeEditorState = {
  /** "pronta" | "sem-migracao" | "sem-chave" (falta service_role) | "erro" */
  status: "pronta" | "sem-migracao" | "sem-chave" | "erro";
  /** O que o editor abre: o rascunho, ou o publicado, ou o de fábrica. */
  rascunho: HomeConfig;
  publicado: HomeConfig;
  /** Existe rascunho salvo diferente do publicado? */
  temRascunho: boolean;
  publicadoEm: string | null;
  publicadoPor: string | null;
};

/**
 * Estado do editor. O rascunho só é lido com o service_role (não tem policy
 * pública); sem a chave — o caso do ambiente local —, o editor ainda abre com
 * o publicado, e avisa que não vai conseguir salvar.
 */
export async function getHomeEditorState(): Promise<HomeEditorState> {
  const base: HomeEditorState = {
    status: "pronta",
    rascunho: DEFAULT_HOME_CONFIG,
    publicado: DEFAULT_HOME_CONFIG,
    temRascunho: false,
    publicadoEm: null,
    publicadoPor: null,
  };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data, error } = await createPublicClient()
      .from("home_config")
      .select("data")
      .eq("slot", "publicado")
      .maybeSingle();
    if (error) return { ...base, status: tabelaAusente(error) ? "sem-migracao" : "erro" };
    const pub = data ? normalizeHomeConfig(data.data) : DEFAULT_HOME_CONFIG;
    return { ...base, status: "sem-chave", rascunho: pub, publicado: pub };
  }

  const { data, error } = await createAdminClient()
    .from("home_config")
    .select("slot, data, updated_at, updated_by");
  if (error) return { ...base, status: tabelaAusente(error) ? "sem-migracao" : "erro" };

  const pubRow = data?.find((r) => r.slot === "publicado");
  const rasRow = data?.find((r) => r.slot === "rascunho");
  const publicado = pubRow ? normalizeHomeConfig(pubRow.data) : DEFAULT_HOME_CONFIG;
  const rascunho = rasRow ? normalizeHomeConfig(rasRow.data) : publicado;
  return {
    status: "pronta",
    rascunho,
    publicado,
    temRascunho:
      !!rasRow && JSON.stringify(rascunho) !== JSON.stringify(publicado),
    publicadoEm: pubRow?.updated_at ?? null,
    publicadoPor: pubRow?.updated_by ?? null,
  };
}

/**
 * Todas as fotos de todas as cores de todos os produtos — o acervo de onde o
 * dono escolhe a foto do destaque e a de cada atalho. UMA consulta, só quando
 * um admin abre o editor (nunca por visita da loja), e só colunas de texto:
 * as fotos em si o navegador baixa como miniatura pelo otimizador.
 *
 * Usa o client público de propósito: produtos, cores e galerias já são de
 * leitura pública, e assim o editor funciona mesmo onde falta a service_role.
 * Não passa por `unstable_cache` — é dado de painel.
 */
export async function getProductPhotos(): Promise<ProductPhoto[]> {
  const { data, error } = await createPublicClient()
    .from("products")
    .select(
      `id, name, category_id, active_ecommerce,
       product_content ( slug ),
       product_colors ( sort_order, gallery, colors ( name ) )`,
    )
    .order("name");
  if (error) {
    console.error("[home] fotos dos produtos", error.message);
    return [];
  }
  type Row = {
    id: string;
    name: string;
    category_id: string | null;
    active_ecommerce: boolean;
    product_content: { slug: string } | { slug: string }[] | null;
    product_colors: {
      sort_order: number;
      gallery: unknown;
      colors: { name: string } | null;
    }[];
  };
  const out: ProductPhoto[] = [];
  for (const p of (data ?? []) as unknown as Row[]) {
    const content = Array.isArray(p.product_content)
      ? p.product_content[0]
      : p.product_content;
    const cores = (p.product_colors ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    for (const c of cores) {
      const gallery = Array.isArray(c.gallery) ? (c.gallery as unknown[]) : [];
      for (const url of gallery) {
        if (typeof url !== "string") continue;
        out.push({
          url,
          productId: p.id,
          // Nome como a vitrine mostra (o ERP grava tudo em maiúsculas).
          productName: displayProductName(p.name),
          slug: content?.slug ?? null,
          categoryId: p.category_id,
          color: c.colors?.name ?? null,
          active: p.active_ecommerce,
        });
      }
    }
  }
  return out;
}
