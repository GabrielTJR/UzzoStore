import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getAllColors, getColorUsage } from "@/lib/admin-products";
import { NewColorForm, ColorRow } from "../color-forms";

export const metadata: Metadata = { title: "Cores" };

export default async function CoresPage() {
  await requireAdmin();
  const [colors, usage] = await Promise.all([getAllColors(), getColorUsage()]);

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/admin"
        className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        ← Produtos
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">
        Cadastro de cores
      </h1>
      <p className="mt-2 text-sm text-muted">
        Cores padronizadas usadas em todos os produtos. Cadastre aqui e depois
        selecione em cada produto — assim os nomes ficam consistentes e dá para
        filtrar por cor na loja.
      </p>

      <div className="mt-8 rounded-lg border border-dashed border-border p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
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
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">
            Nenhuma cor cadastrada ainda.
          </p>
        )}
      </div>
    </section>
  );
}
