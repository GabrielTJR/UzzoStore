import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getAdminHomeSections } from "@/lib/admin-products";
import { HOME_DECORATIONS_ENABLED } from "@/lib/home-sections";
import { KIND_LABEL } from "@/lib/home-sections";
import { AddHomeSectionForm, SectionRowActions } from "../../home-section-forms";

export const metadata: Metadata = { title: "Blocos antigos da home" };

/*
 * A tela de BLOCOS (home_sections) de antes do editor "Página inicial". Saiu
 * do menu em out/2026 — o endereço /admin/decoracao é o editor novo —, mas fica
 * acessível aqui, sem link, porque os blocos continuam guardados no banco e a
 * decoração em blocos pode voltar um dia (ver HOME_DECORATIONS_ENABLED).
 */

/** Resumo curto do conteúdo do bloco, para a lista. */
function summary(kind: string, data: Record<string, unknown>): string {
  if (kind === "aviso") return (data.text as string) || "sem texto";
  if (kind === "banner") {
    const n = Array.isArray(data.slides) ? data.slides.length : 0;
    return `${n} ${n === 1 ? "banner" : "banners"}`;
  }
  if (kind === "mosaico") {
    const n = Array.isArray(data.cards) ? data.cards.length : 0;
    return `${n} ${n === 1 ? "cartão" : "cartões"}`;
  }
  const src = data.source as string;
  return src === "promo"
    ? "produtos em promoção"
    : src === "categoria"
      ? "uma categoria"
      : "produtos em destaque";
}

export default async function DecoracaoPage() {
  await requireAdmin();
  const sections = await getAdminHomeSections();

  return (
    <section className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold lg:text-3xl">
        Decoração da home
      </h1>
      <p className="mt-2 text-sm text-muted">
        Monte a página inicial com blocos: banner, faixa de aviso, mosaico de
        coleções e vitrines de produto. Use ↑ ↓ para ordenar e o botão No
        ar/Oculto para publicar. Blocos novos nascem ocultos — monte primeiro,
        publique depois.
      </p>

      {!HOME_DECORATIONS_ENABLED && (
        <div className="mt-6 rounded-sm border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold">
            A decoração está desligada no site por enquanto.
          </p>
          <p className="mt-1 text-muted">
            A página inicial está usando a base nova, fixa. Os blocos abaixo
            continuam guardados e você pode editá-los, mas nenhum aparece na
            loja até a decoração ser religada.
          </p>
        </div>
      )}

      <div className="mt-8 rounded-sm border border-dashed border-border p-5">
        <p className="mb-3 text-xs font-medium text-muted">
          Novo bloco
        </p>
        <AddHomeSectionForm />
      </div>

      <div className="mt-8 space-y-3">
        {sections.filter((s) => s.kind === "aviso" && s.active).length > 1 && (
          <p className="rounded-xs border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            Há mais de uma faixa de aviso no ar — só a primeira aparece no site.
            Oculte as outras para não ficar dúvida.
          </p>
        )}
        {sections.map((s, i) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xs border border-border p-4"
          >
            <div className="min-w-0">
              <Link
                href={`/admin/decoracao/${s.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {s.name}
              </Link>
              <p className="truncate text-xs text-muted">
                {KIND_LABEL[s.kind]} ·{" "}
                {summary(s.kind, s.data as Record<string, unknown>)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <SectionRowActions
                id={s.id}
                active={s.active}
                isFirst={i === 0}
                isLast={i === sections.length - 1}
              />
              <Link
                href={`/admin/decoracao/${s.id}`}
                className="text-sm underline underline-offset-4 hover:text-foreground"
              >
                Editar
              </Link>
            </div>
          </div>
        ))}
        {sections.length === 0 && (
          <p className="rounded-xs border border-dashed border-border p-4 text-sm text-muted">
            Nenhum bloco ainda — a home mostra o layout padrão (capa +
            destaques).
          </p>
        )}
      </div>
    </section>
  );
}
