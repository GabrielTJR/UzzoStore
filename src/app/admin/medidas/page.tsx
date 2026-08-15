import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getMeasurementModelsList } from "@/lib/admin-products";
import { NewMeasurementModelForm } from "../measurement-forms";

export const metadata: Metadata = { title: "Tabelas de medidas" };

export default async function MedidasPage() {
  await requireAdmin();
  const models = await getMeasurementModelsList();

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/admin"
        className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        ← Produtos
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">
        Tabelas de medidas
      </h1>
      <p className="mt-2 text-sm text-muted">
        Modelos reutilizáveis de tabela de medidas. Crie um modelo, defina as
        colunas (Cintura, Quadril…) e as linhas por tamanho; depois selecione o
        modelo em cada produto. A tabela aparece na página do produto na loja.
      </p>

      <div className="mt-8 rounded-lg border border-dashed border-border p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
          Novo modelo
        </p>
        <NewMeasurementModelForm />
        <p className="mt-3 text-xs text-muted">
          Dê um nome e continue montando a tabela na tela seguinte.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        <p className="text-sm text-muted">
          {models.length} {models.length === 1 ? "modelo" : "modelos"}
        </p>
        {models.map((m) => (
          <Link
            key={m.id}
            href={`/admin/medidas/${m.id}`}
            className="flex items-center justify-between gap-4 rounded-md border border-border p-4 transition-colors hover:border-foreground"
          >
            <span className="font-medium">{m.name}</span>
            <span className="text-xs text-muted">
              {m.columns} {m.columns === 1 ? "coluna" : "colunas"} · {m.rows}{" "}
              {m.rows === 1 ? "tamanho" : "tamanhos"} · {m.products}{" "}
              {m.products === 1 ? "produto" : "produtos"}
            </span>
          </Link>
        ))}
        {models.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">
            Nenhum modelo ainda.
          </p>
        )}
      </div>
    </section>
  );
}
