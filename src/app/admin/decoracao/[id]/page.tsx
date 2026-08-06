import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getAdminHomeSections } from "@/lib/admin-products";
import { getCategories } from "@/lib/products";
import { KIND_LABEL } from "@/lib/home-sections";
import { HomeSectionEditor } from "../../home-section-editor";
import { DeleteHomeSectionButton } from "../../home-section-forms";

export const metadata: Metadata = { title: "Editar bloco da home" };

export default async function EditarBlocoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [sections, categories] = await Promise.all([
    getAdminHomeSections(),
    getCategories(),
  ]);
  const section = sections.find((s) => s.id === id);
  if (!section) notFound();

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/decoracao"
            className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            ← Decoração da home
          </Link>
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">
            {section.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {KIND_LABEL[section.kind]} ·{" "}
            {section.active
              ? "no ar na loja"
              : "oculto — publique na lista de blocos quando terminar"}
          </p>
        </div>
        <DeleteHomeSectionButton id={section.id} label={section.name} />
      </header>

      <HomeSectionEditor section={section} categories={categories} />
    </section>
  );
}
