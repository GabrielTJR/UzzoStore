"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getAdminFor } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { CACHE_TAGS } from "@/lib/products";

const STATUS = new Set(["published", "hidden", "pending"]);

/** Aprova, esconde ou devolve à fila uma avaliação. Derruba o cache das
 * avaliações (a página do produto se refaz com a nova lista). */
export async function setReviewStatusAction(formData: FormData): Promise<void> {
  const actor = await getAdminFor("produtos");
  if (!actor || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !STATUS.has(status)) return;

  const { data } = await createAdminClient()
    .from("product_reviews")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("product_id, rating")
    .maybeSingle();
  if (!data) return;
  await logAudit(actor, {
    action: "review.moderate",
    entityType: "product",
    entityId: data.product_id,
    metadata: { status, rating: data.rating },
  });
  updateTag(CACHE_TAGS.avaliacoes);
  revalidatePath("/admin/avaliacoes");
}

export async function deleteReviewAction(formData: FormData): Promise<void> {
  const actor = await getAdminFor("produtos");
  if (!actor || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { data } = await createAdminClient()
    .from("product_reviews")
    .delete()
    .eq("id", id)
    .select("product_id")
    .maybeSingle();
  if (!data) return;
  await logAudit(actor, {
    action: "review.delete",
    entityType: "product",
    entityId: data.product_id,
  });
  updateTag(CACHE_TAGS.avaliacoes);
  revalidatePath("/admin/avaliacoes");
}
