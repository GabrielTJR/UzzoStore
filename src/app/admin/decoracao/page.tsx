import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getAdminHomeSections } from "@/lib/admin-products";
import { KIND_LABEL } from "@/lib/home-sections";
import {
  AddHomeSectionForm,
  SectionRowActions,
} from "../home-section-forms";

export const metadata: Metadata = { title: "Decoração da home" };

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
    <section className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/admin"
        className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        ← Produtos
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">
        Decoração da home
      </h1>
      <p className="mt-2 text-sm text-muted">
        Monte a página inicial com blocos: banner, faixa de aviso, mosaico de
        coleções e vitrines de produto. Use ↑ ↓ para ordenar e o botão
        No ar/Oculto para publicar. Blocos novos nascem ocultos — monte
        primeiro, publique depois.
      </p>

      <div className="mt-8 rounded-lg border border-dashed border-border p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
          Novo bloco
        </p>
        <AddHomeSectionForm />
      </div>

      <div className="mt-8 space-y-3">
        {sections.filter((s) => s.kind === "aviso" && s.active).length > 1 && (
          <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            Há mais de uma faixa de aviso no ar — só a primeira aparece no site.
            Oculte as outras para não ficar dúvida.
          </p>
        )}
        {sections.map((s, i) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4"
          >
            <div className="min-w-0">
              <Link
                href={`/admin/decoracao/${s.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {KIND_LABEL[s.kind]}
              </Link>
              <p className="truncate text-xs text-muted">
                {summary(s.kind, s.data as Record<string, unknown>)}
              </p>
            </div>
            <SectionRowActions
              id={s.id}
              active={s.active}
              isFirst={i === 0}
              isLast={i === sections.length - 1}
            />
          </div>
        ))}
        {sections.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">
            Nenhum bloco ainda — a home mostra o layout padrão (capa + destaques).
          </p>
        )}
      </div>
    </section>
  );
}
