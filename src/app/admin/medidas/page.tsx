import Link from "next/link";
import type { Metadata } from "next";
import { requireArea } from "@/lib/admin";
import { getMeasurementModelsList } from "@/lib/admin-products";
import { displayProductName } from "@/lib/product-name";
import { SubmitButton } from "@/components/submit-button";
import { duplicateMeasurementModelAction } from "../actions";
import { PageHeader, Panel } from "../admin-ui";
import { NewMeasurementModelForm } from "../measurement-forms";

export const metadata: Metadata = { title: "Tabelas de medidas" };

/** Quantos nomes de produto mostrar antes do "e mais N". */
const MAX_PRODUTOS = 3;

export default async function MedidasPage() {
  await requireArea("medidas");
  const models = await getMeasurementModelsList();

  return (
    <>
      <PageHeader
        title="Tabelas de medidas"
        description="Modelos reutilizáveis: monte a tabela uma vez e escolha o modelo em cada produto. Ela aparece na página da peça, no botão de medidas."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <p className="mb-3 text-sm text-muted">
            {models.length} {models.length === 1 ? "modelo" : "modelos"}
          </p>
          <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {models.map((m) => {
              const extra = m.usadoEm.length - MAX_PRODUTOS;
              return (
                <li key={m.id}>
                  <Panel className="flex h-full flex-col">
                    <Link
                      href={`/admin/medidas/${m.id}`}
                      className="group flex-1 p-4"
                    >
                      <p className="font-semibold group-hover:underline group-hover:underline-offset-4">
                        {m.name}
                      </p>
                      {m.rows > 0 && m.columns > 0 ? (
                        <dl className="mt-2 space-y-1 text-sm">
                          <div className="flex gap-2">
                            <dt className="w-20 shrink-0 text-muted">
                              Medidas
                            </dt>
                            <dd className="truncate">{m.colunas.join(", ")}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="w-20 shrink-0 text-muted">
                              Tamanhos
                            </dt>
                            <dd className="truncate">
                              {m.tamanhos.join(", ")}
                            </dd>
                          </div>
                        </dl>
                      ) : (
                        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                          Tabela vazia — abra para preencher.
                        </p>
                      )}
                      <p className="mt-3 text-sm text-muted">
                        {m.usadoEm.length === 0
                          ? "Nenhum produto usa ainda"
                          : `Em ${m.usadoEm
                              .slice(0, MAX_PRODUTOS)
                              .map((p) => displayProductName(p.name))
                              .join(
                                ", ",
                              )}${extra > 0 ? ` e mais ${extra}` : ""}`}
                      </p>
                    </Link>
                    <div className="flex items-center justify-between border-t border-border px-4 py-2 text-sm">
                      <Link
                        href={`/admin/medidas/${m.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        Editar
                      </Link>
                      <form action={duplicateMeasurementModelAction}>
                        <input type="hidden" name="modelId" value={m.id} />
                        <SubmitButton
                          pendingText="Duplicando…"
                          className="underline-offset-4 hover:underline"
                        >
                          Duplicar
                        </SubmitButton>
                      </form>
                    </div>
                  </Panel>
                </li>
              );
            })}
          </ul>
          {models.length === 0 && (
            <Panel className="p-8 text-center text-sm text-muted">
              Nenhum modelo ainda. Crie o primeiro ao lado.
            </Panel>
          )}
        </div>

        <Panel className="p-5">
          <h2 className="mb-4 font-semibold">Novo modelo</h2>
          <NewMeasurementModelForm />
          <p className="mt-3 text-xs text-muted">
            Dê um nome e monte a tabela na tela seguinte. Para partir de uma
            parecida, use Duplicar.
          </p>
        </Panel>
      </div>
    </>
  );
}
