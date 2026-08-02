import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getMeasurementModel } from "@/lib/admin-products";
import { MeasurementModelEditor } from "../../measurement-model-editor";
import { DeleteMeasurementModelButton } from "../../measurement-forms";

export const metadata: Metadata = { title: "Editar tabela de medidas" };

export default async function EditarMedidaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const model = await getMeasurementModel(id);
  if (!model) notFound();

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/medidas"
            className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            ← Tabelas de medidas
          </Link>
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">
            {model.name}
          </h1>
        </div>
        <DeleteMeasurementModelButton modelId={model.id} name={model.name} />
      </header>

      <MeasurementModelEditor model={model} />
    </section>
  );
}
