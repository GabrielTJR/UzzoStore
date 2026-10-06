import type { Metadata } from "next";
import { requireArea } from "@/lib/admin";
import { getAllColors, getColorUsage } from "@/lib/admin-products";
import { PageHeader, Panel } from "../admin-ui";
import { NewColorForm, ColorCard } from "../color-forms";

export const metadata: Metadata = { title: "Cores" };

/** "Azul-Marinho" e "azul marinho" viram a mesma chave. */
const chave = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Pares de nomes que provavelmente são a MESMA cor ("Marinho" e "Azul
 * Marinho"): um contém o outro como palavra inteira. Cor duplicada divide o
 * filtro da loja em dois e esconde metade das peças de quem escolhe uma delas.
 */
function parecidas(nomes: string[]): [string, string][] {
  const ks = nomes.map((n) => ({ n, k: ` ${chave(n)} ` }));
  const pares: [string, string][] = [];
  for (let i = 0; i < ks.length; i++)
    for (let j = i + 1; j < ks.length; j++) {
      const [a, b] = [ks[i], ks[j]];
      if (a.k.includes(b.k) || b.k.includes(a.k)) pares.push([a.n, b.n]);
    }
  return pares;
}

export default async function CoresPage() {
  await requireArea("cores");
  const [colors, usage] = await Promise.all([getAllColors(), getColorUsage()]);
  const semAmostra = colors.filter((c) => !c.hex);
  const pares = parecidas(colors.map((c) => c.name));

  return (
    <>
      <PageHeader
        title="Cores"
        description="Cores padronizadas de todos os produtos. A amostra é a bolinha que aparece no card e na página da peça; o nome é o que o cliente filtra na loja."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <p className="mb-3 text-sm text-muted">
            {colors.length} {colors.length === 1 ? "cor" : "cores"}
          </p>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
            {colors.map((c) => (
              <ColorCard key={c.id} color={c} usage={usage[c.id] ?? 0} />
            ))}
          </ul>
          {colors.length === 0 && (
            <Panel className="p-8 text-center text-sm text-muted">
              Nenhuma cor cadastrada ainda.
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel className="p-5">
            <h2 className="mb-4 font-semibold">Nova cor</h2>
            <NewColorForm />
          </Panel>

          {(semAmostra.length > 0 || pares.length > 0) && (
            <Panel className="space-y-4 p-5 text-sm">
              <h2 className="font-semibold">Vale conferir</h2>
              {semAmostra.length > 0 && (
                <div>
                  <p className="font-medium">
                    {semAmostra.length}{" "}
                    {semAmostra.length === 1
                      ? "cor sem amostra"
                      : "cores sem amostra"}
                  </p>
                  <p className="text-muted">
                    Sem amostra, a bolinha não aparece no card:{" "}
                    {semAmostra.map((c) => c.name).join(", ")}.
                  </p>
                </div>
              )}
              {pares.length > 0 && (
                <div>
                  <p className="font-medium">Nomes parecidos</p>
                  <p className="mb-1 text-muted">
                    Se forem a mesma cor, o filtro da loja fica dividido em
                    dois. Use uma só nos produtos e exclua a outra.
                  </p>
                  <ul className="space-y-0.5">
                    {pares.map(([a, b]) => (
                      <li key={`${a}|${b}`}>
                        {a} e {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
