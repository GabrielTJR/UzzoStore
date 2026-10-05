import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getAllColors, getColorUsage } from "@/lib/admin-products";
import { NewColorForm, ColorRow } from "../color-forms";

export const metadata: Metadata = { title: "Cores" };

export default async function CoresPage() {
  await requireAdmin();
  const [colors, usage] = await Promise.all([getAllColors(), getColorUsage()]);

  return (
    <section className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold lg:text-3xl">
        Cadastro de cores
      </h1>
      <p className="mt-2 text-sm text-muted">
        Cores padronizadas usadas em todos os produtos. Cadastre aqui e depois
        selecione em cada produto — assim os nomes ficam consistentes e dá para
        filtrar por cor na loja.
      </p>

      <div className="mt-8 rounded-sm border border-dashed border-border p-5">
        <p className="mb-3 text-xs font-medium text-muted">
          Nova cor
        </p>
        <NewColorForm />
      </div>

      <div className="mt-8 space-y-3">
        <p className="text-sm text-muted">
          {colors.length} {colors.length === 1 ? "cor" : "cores"}
        </p>
        {colors.map((c) => (
          <ColorRow key={c.id} color={c} usage={usage[c.id] ?? 0} />
        ))}
        {colors.length === 0 && (
          <p className="rounded-xs border border-dashed border-border p-4 text-sm text-muted">
            Nenhuma cor cadastrada ainda.
          </p>
        )}
      </div>
    </section>
  );
}
