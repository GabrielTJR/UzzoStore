import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/format";
import { toggleCouponAction, deleteCouponAction } from "@/app/admin/actions";
import { CouponForm } from "./coupon-form";

export const dynamic = "force-dynamic";

export default async function AdminCuponsPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: coupons } = await admin
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Cupons
        </h1>
        <p className="mt-1 text-sm text-muted">
          Desconto percentual validado no servidor — o cliente digita o código
          na sacola.
        </p>
      </header>

      <CouponForm />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Desconto</th>
              <th className="px-4 py-3">Mínimo</th>
              <th className="px-4 py-3">Usos</th>
              <th className="px-4 py-3">Validade</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(coupons ?? []).map((c) => {
              const expirado =
                c.expires_at && new Date(c.expires_at) < new Date();
              return (
                <tr key={c.code}>
                  <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                  <td className="px-4 py-3">{Number(c.percent_off)}%</td>
                  <td className="px-4 py-3">
                    {Number(c.min_subtotal) > 0
                      ? formatBRL(Number(c.min_subtotal))
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {c.used_count}
                    {c.max_uses != null ? ` / ${c.max_uses}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    {c.expires_at
                      ? new Date(c.expires_at).toLocaleDateString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {expirado ? (
                      <span className="text-muted">expirado</span>
                    ) : c.active ? (
                      <span className="font-medium text-green-600">ativo</span>
                    ) : (
                      <span className="text-muted">pausado</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <form action={toggleCouponAction}>
                        <input type="hidden" name="code" value={c.code} />
                        <input
                          type="hidden"
                          name="active"
                          value={c.active ? "0" : "1"}
                        />
                        <button className="text-xs underline underline-offset-4 hover:text-foreground">
                          {c.active ? "pausar" : "ativar"}
                        </button>
                      </form>
                      <form action={deleteCouponAction}>
                        <input type="hidden" name="code" value={c.code} />
                        <button className="text-xs text-red-600 underline underline-offset-4">
                          excluir
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(coupons ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  Nenhum cupom ainda — crie o primeiro acima.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
