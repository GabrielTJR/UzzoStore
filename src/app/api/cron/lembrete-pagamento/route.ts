import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendPaymentReminderEmail,
  sendReviewRequestEmail,
} from "@/lib/email";
import { logAudit } from "@/lib/audit";

/**
 * Rotina DIÁRIA (vercel.json → crons). Faz duas coisas na MESMA invocação
 * (o caminho ficou com o nome da primeira):
 *  1. lembrete de pagamento não concluído;
 *  2. convite para avaliar as peças, alguns dias depois de concluído.
 *
 * Custo: UMA invocação por dia, mais um e-mail por pedido elegível (teto de
 * `MAX_POR_DIA` para cada um, que protege a cota do Resend — a mesma dos
 * avisos de pedido pago). Nada roda por visita.
 *
 * Lembrete — elegível: pedido ONLINE de cliente com conta que EXPIROU sem
 * pagamento nas últimas 72 h, ainda sem lembrete, e cujo cliente não fez outro
 * pedido depois (pago ou em aberto) — quem voltou e comprou não recebe "você
 * esqueceu". Cancelado de propósito (pelo cliente ou pela loja) não entra.
 *
 * Convite — elegível: pedido PAGO e CONCLUÍDO há entre `CONVITE_APOS_DIAS` e
 * `CONVITE_ATE_DIAS` dias, de cliente com conta, ainda sem convite, com pelo
 * menos uma peça que o cliente ainda não avaliou.
 *
 * As marcas (`payment_reminder_sent_at`, `review_request_sent_at`) são
 * gravadas ANTES do envio, de forma condicional: duas execuções juntas não
 * mandam dois e-mails.
 *
 * Protegido pelo `CRON_SECRET` (a Vercel o manda no cabeçalho da chamada da
 * rotina). Sem a env, a rota recusa — ninguém de fora dispara e-mails.
 */
export const dynamic = "force-dynamic";

const MAX_POR_DIA = 30;
const JANELA_H = 72;
/** Dias depois de concluído: dá tempo de usar a peça (e, na entrega, de ela
 * chegar — "concluído" costuma ser marcado no envio da confirmação). */
const CONVITE_APOS_DIAS = 5;
/** Depois disso o convite já não faz sentido (e não pega pedido antigo). */
const CONVITE_ATE_DIAS = 20;

type Admin = ReturnType<typeof createAdminClient>;

export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return NextResponse.json({ error: "config" }, { status: 500 });

  const admin = createAdminClient();
  const lembretes = await lembretePagamento(admin);
  const convites = await conviteAvaliacao(admin);
  return NextResponse.json({ ok: true, lembretes, convites });
}

async function contato(admin: Admin, customerId: string) {
  const [{ data: perfil }, { data: auth }] = await Promise.all([
    admin
      .from("customers")
      .select("full_name")
      .eq("id", customerId)
      .maybeSingle(),
    admin.auth.admin.getUserById(customerId),
  ]);
  return {
    to: auth?.user?.email ?? null,
    nome: perfil?.full_name ?? null,
  };
}

async function lembretePagamento(admin: Admin): Promise<number> {
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

    const { to, nome } = await contato(admin, o.customer_id);
    if (!to) continue;
    const ok = await sendPaymentReminderEmail({
      to,
      customerName: nome,
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
  return enviados;
}

async function conviteAvaliacao(admin: Admin): Promise<number> {
  const dia = 86_400_000;
  const ate = new Date(Date.now() - CONVITE_APOS_DIAS * dia).toISOString();
  const desde = new Date(Date.now() - CONVITE_ATE_DIAS * dia).toISOString();
  const { data: candidatos, error } = await admin
    .from("orders")
    .select(
      "id, number, customer_id, order_items ( product_name, product_variants ( product_id ) )",
    )
    .eq("payment_status", "paid")
    .eq("fulfillment_status", "done")
    .is("review_request_sent_at", null)
    .not("customer_id", "is", null)
    .gte("done_at", desde)
    .lte("done_at", ate)
    .order("done_at", { ascending: true })
    .limit(MAX_POR_DIA * 2);
  // Sem a migração 0030 a coluna não existe: não manda nada (e não quebra o
  // lembrete de pagamento, que já rodou).
  if (error) return 0;

  let enviados = 0;
  const vistos = new Set<string>(); // um convite por cliente por rodada
  for (const o of (candidatos ?? []) as unknown as {
    id: string;
    number: number;
    customer_id: string;
    order_items: {
      product_name: string;
      product_variants: { product_id: string } | null;
    }[];
  }[]) {
    if (enviados >= MAX_POR_DIA) break;
    if (vistos.has(o.customer_id)) continue;

    // Só as peças que o cliente ainda não avaliou (uma vez cada produto).
    const porProduto = new Map<string, string>();
    for (const i of o.order_items ?? []) {
      const pid = i.product_variants?.product_id;
      if (pid && !porProduto.has(pid)) porProduto.set(pid, i.product_name);
    }
    if (porProduto.size === 0) continue;
    const { data: feitas } = await admin
      .from("product_reviews")
      .select("product_id")
      .eq("customer_id", o.customer_id)
      .in("product_id", [...porProduto.keys()]);
    for (const r of feitas ?? []) porProduto.delete(r.product_id);
    if (porProduto.size === 0) continue;

    const { data: marcou } = await admin
      .from("orders")
      .update({ review_request_sent_at: new Date().toISOString() })
      .eq("id", o.id)
      .is("review_request_sent_at", null)
      .select("id")
      .maybeSingle();
    if (!marcou) continue;
    vistos.add(o.customer_id);

    const { to, nome } = await contato(admin, o.customer_id);
    if (!to) continue;
    const ok = await sendReviewRequestEmail({
      to,
      customerName: nome,
      orderId: o.id,
      orderNumber: o.number,
      items: [...porProduto.values()].map((productName) => ({ productName })),
    });
    if (ok) enviados++;
  }

  await logAudit(null, {
    action: "cron.review_request",
    entityType: "cron",
    metadata: { candidatos: candidatos?.length ?? 0, enviados },
  });
  return enviados;
}
