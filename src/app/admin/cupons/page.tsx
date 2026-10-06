import type { Metadata } from "next";
import { requireArea } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/format";
import { toggleCouponAction } from "@/app/admin/actions";
import { PageHeader, Panel } from "../admin-ui";
import { CouponForm } from "./coupon-form";
import { DeleteCouponButton } from "./delete-coupon-button";

export const metadata: Metadata = { title: "Cupons" };
export const dynamic = "force-dynamic";

type Situacao = "ativo" | "pausado" | "expirado" | "esgotado";

const SITUACAO: Record<Situacao, { rotulo: string; classe: string }> = {
  ativo: {
    rotulo: "Ativo",
    classe: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  },
  pausado: { rotulo: "Pausado", classe: "bg-surface text-muted" },
  expirado: { rotulo: "Expirado", classe: "bg-surface text-muted" },
  esgotado: {
    rotulo: "Limite atingido",
    classe: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
};

const data = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/**
 * Cupons + o que cada um rendeu. O "rendeu" vem dos pedidos PAGOS que levaram
 * o código (uma consulta só, aqui, quando alguém da equipe abre a tela — nada
 * roda na loja). Pedido pendente não conta: cupom de link recusado não vendeu.
 */
export default async function AdminCuponsPage() {
  await requireArea("cupons");
  const admin = createAdminClient();
  const [{ data: coupons }, { data: pedidos }] = await Promise.all([
    admin
      .from("coupons")
      .select(
        "code, percent_off, min_subtotal, max_uses, used_count, expires_at, active",
      )
      .order("created_at", { ascending: false }),
    admin
      .from("orders")
      .select("coupon_code, total, discount")
      .eq("payment_status", "paid")
      .not("coupon_code", "is", null),
  ]);

  const rendeu = new Map<
    string,
    { pedidos: number; vendido: number; desconto: number }
  >();
  for (const p of pedidos ?? []) {
    const k = String(p.coupon_code).toUpperCase();
    const r = rendeu.get(k) ?? { pedidos: 0, vendido: 0, desconto: 0 };
    r.pedidos += 1;
    r.vendido += Number(p.total);
    r.desconto += Number(p.discount);
    rendeu.set(k, r);
  }

  const agora = new Date();
  const lista = (coupons ?? []).map((c) => {
    const situacao: Situacao =
      c.expires_at && new Date(c.expires_at) < agora
        ? "expirado"
        : c.max_uses != null && c.used_count >= c.max_uses
          ? "esgotado"
          : c.active
            ? "ativo"
            : "pausado";
    return { ...c, situacao, rendeu: rendeu.get(c.code.toUpperCase()) };
  });
  const ativos = lista.filter((c) => c.situacao === "ativo").length;

  return (
    <>
      <PageHeader
        title="Cupons"
        description="Desconto em porcentagem que o cliente digita na sacola. A validação é toda no servidor; o uso só conta quando o pagamento entra."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm text-muted lg:px-5">
            <span>
              {lista.length} {lista.length === 1 ? "cupom" : "cupons"}
            </span>
            <span>
              {ativos} {ativos === 1 ? "ativo" : "ativos"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 font-medium lg:pl-5">Cupom</th>
                  <th className="px-4 py-2.5 font-medium">Regras</th>
                  <th className="px-4 py-2.5 font-medium">Usos</th>
                  <th className="px-4 py-2.5 font-medium">Rendeu</th>
                  <th className="px-4 py-2.5 font-medium">Situação</th>
                  <th className="px-4 py-2.5 lg:pr-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.map((c) => {
                  const s = SITUACAO[c.situacao];
                  return (
                    <tr key={c.code} className="align-top">
                      <td className="px-4 py-3 lg:pl-5">
                        <p className="font-mono font-semibold">{c.code}</p>
                        <p className="text-muted">
                          {Number(c.percent_off)}% de desconto
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        <p>
                          {Number(c.min_subtotal) > 0
                            ? `Acima de ${formatBRL(Number(c.min_subtotal))}`
                            : "Qualquer valor"}
                        </p>
                        <p>
                          {c.expires_at
                            ? `Até ${data(c.expires_at)}`
                            : "Sem validade"}
                        </p>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {c.used_count}
                        {c.max_uses != null && (
                          <span className="text-muted"> de {c.max_uses}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {c.rendeu ? (
                          <>
                            <p className="font-medium">
                              {formatBRL(c.rendeu.vendido)}
                            </p>
                            <p className="text-muted">
                              {c.rendeu.pedidos}{" "}
                              {c.rendeu.pedidos === 1 ? "pedido" : "pedidos"},{" "}
                              {formatBRL(c.rendeu.desconto)} de desconto
                            </p>
                          </>
                        ) : (
                          <span className="text-muted">Nenhuma venda</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-xs px-2 py-0.5 text-xs font-semibold ${s.classe}`}
                        >
                          {s.rotulo}
                        </span>
                      </td>
                      <td className="px-4 py-3 lg:pr-5">
                        <div className="flex justify-end gap-4">
                          {(c.situacao === "ativo" ||
                            c.situacao === "pausado") && (
                            <form action={toggleCouponAction}>
                              <input type="hidden" name="code" value={c.code} />
                              <input
                                type="hidden"
                                name="active"
                                value={c.active ? "0" : "1"}
                              />
                              <button className="text-sm font-medium underline-offset-4 hover:underline">
                                {c.active ? "Pausar" : "Ativar"}
                              </button>
                            </form>
                          )}
                          <DeleteCouponButton
                            code={c.code}
                            usos={c.used_count}
                            ativo={c.active}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {lista.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-muted"
                    >
                      Nenhum cupom ainda. Crie o primeiro ao lado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-4 font-semibold">Novo cupom</h2>
          <CouponForm />
        </Panel>
      </div>
    </>
  );
}
