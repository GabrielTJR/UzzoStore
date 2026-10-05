"use server";

import { updateTag } from "next/cache";
import { getAdminUser } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { CACHE_TAGS } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import {
  DEFAULT_HOME_CONFIG,
  imagemDaLoja,
  normalizeHomeConfig,
  type HomeConfig,
} from "@/lib/home-config";

/**
 * Página inicial editável (/admin/decoracao): salvar rascunho, publicar e
 * descartar. Server Action é endpoint PÚBLICO — cada uma confere o admin no
 * servidor, nunca confia na tela.
 *
 * O que chega do navegador passa pela MESMA normalização da leitura
 * (`normalizeHomeConfig`) e, por cima, pelas conferências que só o servidor
 * faz: a peça do "Na foto" tem que existir (nome e endereço saem do banco, não
 * do formulário) e toda foto é remontada a partir do caminho no NOSSO bucket.
 */

export type HomeConfigResult = {
  ok: boolean;
  error?: string;
  /** A configuração como ficou gravada (o editor passa a mostrar esta). */
  config?: HomeConfig;
};

const BUCKET = "product-images";

/** A tabela ainda não existe? (migração 0023 não aplicada) */
function semTabela(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /home_config/.test(error.message ?? "")
  );
}

const MSG_SEM_MIGRACAO =
  "A tabela da página inicial ainda não existe — aplique a migração 0023 no Supabase.";

async function autorizar() {
  const actor = await getAdminUser();
  if (!actor) return { actor: null, erro: "Não autorizado." } as const;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return {
      actor: null,
      erro: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor.",
    } as const;
  return { actor, erro: null } as const;
}

/**
 * Normaliza e confere o que veio do editor. Devolve a configuração pronta para
 * gravar, ou a mensagem de erro para o dono.
 */
async function validar(
  raw: unknown,
): Promise<{ config: HomeConfig } | { erro: string }> {
  if (!raw || typeof raw !== "object") return { erro: "Dados inválidos." };
  // Teto de tamanho: a configuração inteira cabe em poucos KB.
  if (JSON.stringify(raw).length > 60_000) return { erro: "Dados grandes demais." };

  const r = raw as { hero?: { title?: unknown; image?: unknown } };
  if (typeof r.hero?.title !== "string" || !r.hero.title.trim())
    return { erro: "Escreva o título do destaque principal." };
  if (!imagemDaLoja(r.hero?.image))
    return { erro: "Escolha a foto do destaque principal." };

  // Cópia: a normalização pode devolver pedaços do valor de fábrica, e abaixo
  // a configuração é ajustada no lugar.
  const config = structuredClone(normalizeHomeConfig(raw));
  const admin = createAdminClient();

  // Foto: remonta a URL pública a partir do caminho (nunca grava a URL como
  // veio do navegador, mesmo já validada pelo prefixo).
  const remonta = (url: string): string => {
    const marca = `/storage/v1/object/public/${BUCKET}/`;
    const caminho = url.slice(url.indexOf(marca) + marca.length);
    return admin.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
  };
  config.hero.image = remonta(config.hero.image);
  for (const id of Object.keys(config.atalhos.fotos))
    config.atalhos.fotos[id] = remonta(config.atalhos.fotos[id]);

  // "Na foto": nome e endereço da peça saem do banco.
  if (config.hero.look) {
    const { data } = await admin
      .from("product_content")
      .select("slug, products!inner ( name )")
      .eq("slug", config.hero.look.slug)
      .maybeSingle();
    const nome = (data as unknown as { products: { name: string } } | null)
      ?.products?.name;
    if (!data || !nome)
      return { erro: "A peça escolhida em \"Na foto\" não foi encontrada." };
    config.hero.look = { name: nome, slug: data.slug };
  }

  if (config.avisos.filter((a) => a.active).length === 0)
    return { erro: "Deixe ao menos uma mensagem ligada na faixa de avisos." };

  return { config };
}

async function gravar(
  slots: ("rascunho" | "publicado")[],
  config: HomeConfig,
  email: string | null,
): Promise<string | null> {
  const admin = createAdminClient();
  const agora = new Date().toISOString();
  const { error } = await admin.from("home_config").upsert(
    slots.map((slot) => ({
      slot,
      data: config as unknown as Json,
      updated_at: agora,
      updated_by: email,
    })),
    { onConflict: "slot" },
  );
  if (!error) return null;
  return semTabela(error) ? MSG_SEM_MIGRACAO : "Não foi possível salvar.";
}

/** Guarda o rascunho. A loja não muda. */
export async function saveHomeDraftAction(
  raw: unknown,
): Promise<HomeConfigResult> {
  const { actor, erro } = await autorizar();
  if (!actor) return { ok: false, error: erro };

  const v = await validar(raw);
  if ("erro" in v) return { ok: false, error: v.erro };

  const falha = await gravar(["rascunho"], v.config, actor.email ?? null);
  if (falha) return { ok: false, error: falha };

  await logAudit(actor, {
    action: "home.draft_save",
    entityType: "home_config",
    entityId: "rascunho",
    entityLabel: "Página inicial",
  });
  return { ok: true, config: v.config };
}

/**
 * Publica: grava a mesma configuração no rascunho E no publicado (a loja lê o
 * publicado) e derruba a etiqueta da decoração — a home e a faixa mudam na
 * próxima visita, sem esperar a janela do cache.
 */
export async function publishHomeAction(
  raw: unknown,
): Promise<HomeConfigResult> {
  const { actor, erro } = await autorizar();
  if (!actor) return { ok: false, error: erro };

  const v = await validar(raw);
  if ("erro" in v) return { ok: false, error: v.erro };

  const falha = await gravar(
    ["rascunho", "publicado"],
    v.config,
    actor.email ?? null,
  );
  if (falha) return { ok: false, error: falha };

  updateTag(CACHE_TAGS.decoracao);
  await logAudit(actor, {
    action: "home.publish",
    entityType: "home_config",
    entityId: "publicado",
    entityLabel: "Página inicial",
    metadata: {
      etiquetas: v.config.hero.tags.length,
      avisos: v.config.avisos.filter((a) => a.active).length,
      atalhosOcultos: v.config.atalhos.ocultas.length,
    },
  });
  return { ok: true, config: v.config };
}

/**
 * Descarta o rascunho: apaga a linha e devolve o publicado (ou o de fábrica,
 * se nada foi publicado ainda), que é o que o editor volta a mostrar.
 */
export async function discardHomeDraftAction(): Promise<HomeConfigResult> {
  const { actor, erro } = await autorizar();
  if (!actor) return { ok: false, error: erro };

  const admin = createAdminClient();
  const { error } = await admin.from("home_config").delete().eq("slot", "rascunho");
  if (error)
    return {
      ok: false,
      error: semTabela(error) ? MSG_SEM_MIGRACAO : "Não foi possível descartar.",
    };

  const { data } = await admin
    .from("home_config")
    .select("data")
    .eq("slot", "publicado")
    .maybeSingle();

  await logAudit(actor, {
    action: "home.discard",
    entityType: "home_config",
    entityId: "rascunho",
    entityLabel: "Página inicial",
  });
  return {
    ok: true,
    config: data ? normalizeHomeConfig(data.data) : DEFAULT_HOME_CONFIG,
  };
}
