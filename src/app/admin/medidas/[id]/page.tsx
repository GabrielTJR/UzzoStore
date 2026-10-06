import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireArea } from "@/lib/admin";
import { getMeasurementModel } from "@/lib/admin-products";
import { SubmitButton } from "@/components/submit-button";
import { duplicateMeasurementModelAction } from "../../actions";
import { PageHeader, Panel, secondaryButton } from "../../admin-ui";
import { MeasurementModelEditor } from "../../measurement-model-editor";
import { DeleteMeasurementModelButton } from "../../measurement-forms";

export const metadata: Metadata = { title: "Editar tabela de medidas" };

export default async function EditarMedidaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireArea("medidas");
  const { id } = await params;
  const model = await getMeasurementModel(id);
  if (!model) notFound();

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={model.name}
        back={{ href: "/admin/medidas", label: "Tabelas de medidas" }}
      >
        <form action={duplicateMeasurementModelAction}>
          <input type="hidden" name="modelId" value={model.id} />
          <SubmitButton pendingText="Duplicando…" className={secondaryButton}>
            Duplicar
          </SubmitButton>
        </form>
        <DeleteMeasurementModelButton modelId={model.id} name={model.name} />
      </PageHeader>

      <Panel className="p-5 lg:p-6">
        <MeasurementModelEditor model={model} />
      </Panel>
    </div>
  );
}
