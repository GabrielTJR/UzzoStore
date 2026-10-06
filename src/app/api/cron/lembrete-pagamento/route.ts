import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentReminderEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

/**
 * Rotina DIÁRIA (vercel.json → crons): lembrete de pagamento não concluído.
 *
 * Custo: UMA invocação por dia, mais um e-mail por pedido elegível (teto de
 * `MAX_POR_DIA`, que protege a cota do Resend — a mesma dos avisos de pedido
 * pago). Nada roda por visita.
 *
 * Elegível: pedido ONLINE de cliente com conta que EXPIROU sem pagamento nas
 * últimas 72 h, ainda sem lembrete, e cujo cliente não fez outro pedido
 * depois (pago ou em aberto) — quem voltou e comprou não recebe "você
 * esqueceu". Cancelado de propósito (pelo cliente ou pela loja) não entra.
 *
 * A marca `payment_reminder_sent_at` é gravada ANTES do envio, de forma
 * condicional: duas execuções juntas não mandam dois e-mails.
 *
 * Protegido pelo `CRON_SECRET` (a Vercel o manda no cabeçalho da chamada da
 * rotina). Sem a env, a rota recusa — ninguém de fora dispara e-mails.
 */
export const dynamic = "force-dynamic";

const MAX_POR_DIA = 30;
const JANELA_H = 72;

export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return NextResponse.json({ error: "config" }, { status: 500 });

  const admin = createAdminClient();
  const desde = new Date(Date.now() - JANELA_H * 3_600_000).toISOString();
  const { data: candidatos } = await admin
    .from("orders")
    .select(
      "id, number, customer_id, created_at, order_items ( product_name, variant_label )",
    )
    .eq("channel", "online")
    .eq("payment_status", "expired")
    .is("payment_reminder_sent_at", null)
    .not("customer_id", "is", null)
    .gte("created_at", desde)
    .order("created_at", { ascending: true })
    .limit(MAX_POR_DIA * 2);

  let enviados = 0;
  const vistos = new Set<string>(); // um lembrete por cliente por rodada
  for (const o of (candidatos ?? []) as unknown as {
    id: string;
    number: number;
    customer_id: string;
    created_at: string;
    order_items: { product_name: string; variant_label: string | null }[];
  }[]) {
    if (enviados >= MAX_POR_DIA) break;
    if (vistos.has(o.customer_id)) continue;

    // Comprou ou abriu outro pedido depois? Então não esqueceu.
    const { count } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", o.customer_id)
      .gt("created_at", o.created_at)
      .in("payment_status", ["paid", "pending"]);
    if ((count ?? 0) > 0) continue;

    const { data: marcou } = await admin
      .from("orders")
      .update({ payment_reminder_sent_at: new Date().toISOString() })
      .eq("id", o.id)
      .is("payment_reminder_sent_at", null)
      .select("id")
      .maybeSingle();
    if (!marcou) continue;
    vistos.add(o.customer_id);

    const [{ data: perfil }, { data: auth }] = await Promise.all([
      admin
        .from("customers")
        .select("full_name")
        .eq("id", o.customer_id)
        .maybeSingle(),
      admin.auth.admin.getUserById(o.customer_id),
    ]);
    const to = auth?.user?.email;
    if (!to) continue;
    const ok = await sendPaymentReminderEmail({
      to,
      customerName: perfil?.full_name ?? null,
      orderId: o.id,
      orderNumber: o.number,
      items: (o.order_items ?? []).map((i) => ({
        productName: i.product_name,
        variantLabel: i.variant_label,
      })),
    });
    if (ok) enviados++;
  }

  await logAudit(null, {
    action: "cron.payment_reminder",
    entityType: "cron",
    metadata: { candidatos: candidatos?.length ?? 0, enviados },
  });
  return NextResponse.json({ ok: true, enviados });
}
