import Link from "next/link";
import type { Metadata } from "next";
import { requireArea } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { displayProductName } from "@/lib/product-name";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader, Panel } from "../admin-ui";
import { deleteReviewAction, setReviewStatusAction } from "./actions";

export const metadata: Metadata = { title: "Avaliações" };

const ABAS = [
  ["pending", "Para aprovar"],
  ["published", "Publicadas"],
  ["hidden", "Escondidas"],
] as const;

const quando = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  timeZone: "America/Sao_Paulo",
});

type Linha = {
  id: string;
  rating: number;
  body: string | null;
  author_name: string | null;
  status: string;
  created_at: string;
  products: {
    name: string;
    product_content: { slug: string } | { slug: string }[] | null;
  } | null;
};

/**
 * Moderação das avaliações. Nada aparece na loja sem passar por aqui: quem
 * avalia é comprador verificado (o servidor confere o pedido entregue), mas o
 * texto é livre — é aqui que se barra ofensa ou propaganda.
 */
export default async function AvaliacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireArea("produtos");
  const sp = await searchParams;
  const status = ABAS.some(([s]) => s === sp.status) ? sp.status! : "pending";

  const { data, error } = await createAdminClient()
    .from("product_reviews")
    .select(
      "id, rating, body, author_name, status, created_at, products ( name, product_content ( slug ) )",
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(200);
  const linhas = (data ?? []) as unknown as Linha[];
  const semTabela = !!error;

  const botao =
    "h-9 rounded-xs border border-border px-3 text-sm font-medium hover:border-foreground";

  return (
    <>
      <PageHeader
        title="Avaliações"
        description="Avaliações de quem comprou e recebeu a peça. Só aparecem na loja depois de aprovadas aqui."
      />

      {semTabela && (
        <div className="mb-6 rounded-xs border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          A tabela de avaliações ainda não existe — aplique a migração 0029 no
          Supabase.
        </div>
      )}

      <div className="mb-4 flex w-fit overflow-hidden rounded-xs border border-border">
        {ABAS.map(([s, rotulo], i) => (
          <Link
            key={s}
            href={
              s === "pending"
                ? "/admin/avaliacoes"
                : `/admin/avaliacoes?status=${s}`
            }
            prefetch={false}
            aria-current={s === status ? "page" : undefined}
            className={`inline-flex h-10 items-center px-4 text-sm ${
              i ? "border-l border-border" : ""
            } ${
              s === status
                ? "bg-foreground font-semibold text-background"
                : "bg-background text-muted hover:text-foreground"
            }`}
          >
            {rotulo}
          </Link>
        ))}
      </div>

      <Panel>
        <ul className="divide-y divide-border">
          {linhas.map((r) => {
            const pc = r.products?.product_content;
            const slug = Array.isArray(pc) ? pc[0]?.slug : pc?.slug;
            const nome = displayProductName(r.products?.name ?? "Produto");
            return (
              <li
                key={r.id}
                className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start lg:px-5"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="text-accent">{"★".repeat(r.rating)}</span>
                    <span className="text-border">
                      {"★".repeat(5 - r.rating)}
                    </span>{" "}
                    <span className="font-medium">
                      {slug ? (
                        <Link
                          href={`/produtos/${slug}`}
                          target="_blank"
                          className="underline-offset-4 hover:underline"
                        >
                          {nome}
                        </Link>
                      ) : (
                        nome
                      )}
                    </span>
                  </p>
                  {r.body ? (
                    <p className="mt-1 whitespace-pre-line text-sm">{r.body}</p>
                  ) : (
                    <p className="mt-1 text-sm text-muted">
                      Sem comentário, só a nota.
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {r.author_name ?? "Cliente"},{" "}
                    {quando.format(new Date(r.created_at))}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.status !== "published" && (
                    <form action={setReviewStatusAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value="published" />
                      <SubmitButton
                        pendingText="…"
                        className="h-9 rounded-xs bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90"
                      >
                        Publicar
                      </SubmitButton>
                    </form>
                  )}
                  {r.status !== "hidden" && (
                    <form action={setReviewStatusAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value="hidden" />
                      <SubmitButton pendingText="…" className={botao}>
                        Esconder
                      </SubmitButton>
                    </form>
                  )}
                  <form action={deleteReviewAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <SubmitButton
                      pendingText="…"
                      className="h-9 px-2 text-sm text-red-600 underline-offset-4 hover:underline dark:text-red-400"
                    >
                      Excluir
                    </SubmitButton>
                  </form>
                </div>
              </li>
            );
          })}
          {linhas.length === 0 && !semTabela && (
            <li className="p-8 text-center text-sm text-muted">
              {status === "pending"
                ? "Nenhuma avaliação esperando aprovação."
                : "Nada aqui por enquanto."}
            </li>
          )}
        </ul>
      </Panel>
    </>
  );
}
