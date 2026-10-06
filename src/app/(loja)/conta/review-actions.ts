"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/customer";
import { freiaIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { nomePublico } from "@/lib/reviews";

/**
 * O cliente avalia uma peça de um pedido SEU, pago e ENTREGUE. Tudo
 * conferido aqui (server action é endpoint público): pedido do próprio
 * cliente, situação, e que a peça está no pedido. Entra "pendente" — só
 * aparece na loja depois de aprovada no painel. Avaliar de novo a mesma peça
 * substitui a anterior (e volta para a fila de aprovação).
 */
export async function submitReviewAction(input: {
  orderId: string;
  productId: string;
  rating: number;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entre na sua conta para avaliar." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return { ok: false, error: "Tente novamente mais tarde." };

  const rating = Math.round(Number(input.rating));
  if (!(rating >= 1 && rating <= 5))
    return { ok: false, error: "Escolha de 1 a 5 estrelas." };
  const body =
    String(input.body ?? "")
      .trim()
      .slice(0, 1000) || null;

  if (await freiaIp("review.create", 15))
    return {
      ok: false,
      error: "Muitas avaliações seguidas. Aguarde um pouco.",
    };

  const admin = createAdminClient();
  const { data: pedido } = await admin
    .from("orders")
    .select(
      "id, payment_status, fulfillment_status, order_items ( product_variants ( product_id ) )",
    )
    .eq("id", String(input.orderId ?? ""))
    .eq("customer_id", user.id)
    .maybeSingle();
  if (!pedido) return { ok: false, error: "Pedido não encontrado." };
  if (pedido.payment_status !== "paid" || pedido.fulfillment_status !== "done")
    return {
      ok: false,
      error: "Dá para avaliar depois que o pedido for entregue.",
    };
  const temPeca = (
    (
      pedido as unknown as {
        order_items: { product_variants: { product_id: string } | null }[];
      }
    ).order_items ?? []
  ).some((i) => i.product_variants?.product_id === input.productId);
  if (!temPeca) return { ok: false, error: "Esta peça não está no pedido." };

  const { data: perfil } = await admin
    .from("customers")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await admin.from("product_reviews").upsert(
    {
      product_id: input.productId,
      customer_id: user.id,
      order_id: pedido.id,
      rating,
      body,
      author_name: nomePublico(perfil?.full_name),
      status: "pending",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "product_id,customer_id" },
  );
  if (error) return { ok: false, error: "Não foi possível salvar agora." };

  await logAudit(user, {
    action: "review.create",
    entityType: "product",
    entityId: input.productId,
    metadata: { rating },
  });
  revalidatePath(`/conta/pedidos/${pedido.id}`);
  return { ok: true };
}

/** Quais produtos o cliente já avaliou (para o pedido mostrar "Avaliado"). */
export async function minhasAvaliacoes(): Promise<
  Record<string, { rating: number; status: string }>
> {
  const user = await getCurrentUser();
  if (!user || !process.env.SUPABASE_SERVICE_ROLE_KEY) return {};
  const { data, error } = await createAdminClient()
    .from("product_reviews")
    .select("product_id, rating, status")
    .eq("customer_id", user.id);
  if (error || !data) return {};
  return Object.fromEntries(
    data.map((r) => [r.product_id, { rating: r.rating, status: r.status }]),
  );
}
