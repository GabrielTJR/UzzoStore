"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminUser, slugify } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

const BUCKET = "product-images";

export type ActionResult = { ok: boolean; error?: string };
export type UploadTarget = { path: string; token: string };

type AdminClient = ReturnType<typeof createAdminClient>;

function parsePrice(raw: FormDataEntryValue | null): number {
  let s = String(raw ?? "").trim();
  if (!s) return NaN;
  // Aceita formato pt-BR: remove separador de milhar '.' e usa ',' como decimal.
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return Number(s);
}

function parseQty(raw: FormDataEntryValue | null): number {
  const n = parseInt(String(raw ?? "0").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

const ALLOWED_EXT = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "heic",
  "heif",
]);

/** Valida um caminho de objeto no Storage ("pasta/arquivo.ext") — sem barra inicial nem traversal. */
function isSafeStoragePath(path: string): boolean {
  return /^[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+\.[A-Za-z0-9]+$/.test(path);
}

function publicUrlForPath(admin: AdminClient, path: string): string {
  return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function resolveCategoryId(
  admin: AdminClient,
  name: string,
): Promise<string | null> {
  if (!name) return null;
  const { data: cat } = await admin
    .from("categories")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (cat) return cat.id;
  const { data: created } = await admin
    .from("categories")
    .insert({
      microvix_id: `manual-cat-${randomUUID()}`,
      name,
      kind: "setor",
    })
    .select("id")
    .single();
  return created?.id ?? null;
}

/** Garante que exista a linha em product_content (produtos vindos do ERP podem não ter). */
async function ensureProductContent(
  admin: AdminClient,
  productId: string,
): Promise<void> {
  const { data } = await admin
    .from("product_content")
    .select("product_id")
    .eq("product_id", productId)
    .maybeSingle();
  if (data) return;

  const { data: prod } = await admin
    .from("products")
    .select("name")
    .eq("id", productId)
    .maybeSingle();
  const name = prod?.name ?? "Produto";
  let slug = slugify(name) || `produto-${productId.slice(0, 8)}`;
  const { data: exists } = await admin
    .from("product_content")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (exists) slug = `${slug}-${productId.slice(0, 8)}`;

  await admin.from("product_content").insert({
    product_id: productId,
    slug,
    meta_title: name,
    meta_description: "Moda masculina Uzzo Store.",
    featured: false,
    sort_order: 999,
    gallery: [],
  });
}

function revalidateProduct(id?: string) {
  revalidatePath("/admin");
  if (id) revalidatePath(`/admin/produtos/${id}`);
  revalidatePath("/produtos");
  revalidatePath("/");
}

function serviceRoleMissing(): boolean {
  return !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// ---------------------------------------------------------------------------

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function createProductAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await getAdminUser();
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (serviceRoleMissing())
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const name = String(formData.get("name") ?? "").trim();
  const categoryName = String(formData.get("category") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const price = parsePrice(formData.get("price"));
  const sizes = String(formData.get("sizes") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const description = String(formData.get("description") ?? "").trim() || null;
  const imagePath = String(formData.get("imagePath") ?? "").trim();

  if (!name) return { ok: false, error: "Informe o nome do produto." };
  if (!Number.isFinite(price) || price <= 0)
    return { ok: false, error: "Informe um preço válido." };

  const admin = createAdminClient();
  const categoryId = await resolveCategoryId(admin, categoryName);

  const { data: product, error: prodErr } = await admin
    .from("products")
    .insert({
      microvix_id: `manual-${randomUUID()}`,
      reference,
      name,
      brand: "Uzzo",
      category_id: categoryId,
      active_ecommerce: true,
    })
    .select("id")
    .single();
  if (prodErr || !product)
    return { ok: false, error: "Erro ao criar o produto." };

  // Sem tamanhos: cria uma variante única (peça única / acessório).
  const variantSizes = sizes.length ? sizes : [null];
  for (const size of variantSizes) {
    const { data: variant } = await admin
      .from("product_variants")
      .insert({
        microvix_id: `manual-${randomUUID()}`,
        product_id: product.id,
        size,
        color: null,
      })
      .select("id")
      .single();
    if (!variant) continue;
    await admin
      .from("prices")
      .insert({ variant_id: variant.id, tabela_id: "default", price });
    await admin.from("stock_cache").insert({
      variant_id: variant.id,
      deposito_id: "loja",
      qty_available: 0,
    });
  }

  let gallery: string[] = [];
  if (imagePath && isSafeStoragePath(imagePath)) {
    gallery = [publicUrlForPath(admin, imagePath)];
  }

  let slug = slugify(name) || `produto-${product.id.slice(0, 8)}`;
  const { data: exists } = await admin
    .from("product_content")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (exists) slug = `${slug}-${product.id.slice(0, 8)}`;

  await admin.from("product_content").insert({
    product_id: product.id,
    slug,
    meta_title: name,
    meta_description: description ?? "Moda masculina Uzzo Store.",
    rich_description: description,
    featured: false,
    sort_order: 999,
    gallery,
  });

  await logAudit(actor, {
    action: "product.create",
    entityType: "product",
    entityId: product.id,
    entityLabel: name,
    metadata: { price, sizes },
  });
  revalidateProduct(product.id);
  redirect(`/admin/produtos/${product.id}`);
}

export async function updateProductAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await getAdminUser();
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (serviceRoleMissing())
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const id = String(formData.get("productId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const categoryName = String(formData.get("category") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const active = formData.get("active") === "on";
  const featured = formData.get("featured") === "on";

  if (!id) return { ok: false, error: "Produto inválido." };
  if (!name) return { ok: false, error: "Informe o nome do produto." };

  const admin = createAdminClient();
  const categoryId = await resolveCategoryId(admin, categoryName);

  const { error: prodErr } = await admin
    .from("products")
    .update({
      name,
      reference,
      category_id: categoryId,
      active_ecommerce: active,
    })
    .eq("id", id);
  if (prodErr) return { ok: false, error: "Erro ao salvar o produto." };

  await ensureProductContent(admin, id);
  await admin
    .from("product_content")
    .update({
      meta_title: name,
      rich_description: description,
      featured,
    })
    .eq("product_id", id);

  await logAudit(actor, {
    action: "product.update",
    entityType: "product",
    entityId: id,
    entityLabel: name,
    metadata: { active, featured },
  });
  revalidateProduct(id);
  return { ok: true };
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const actor = await getAdminUser();
  if (!actor) return;
  if (serviceRoleMissing()) return;

  const id = String(formData.get("productId") ?? "");
  if (!id) return;

  const admin = createAdminClient();

  // Coleta os caminhos das imagens ANTES de excluir (a exclusão remove o conteúdo em cascata).
  const { data: content } = await admin
    .from("product_content")
    .select("gallery")
    .eq("product_id", id)
    .maybeSingle();
  const gallery = Array.isArray(content?.gallery)
    ? (content!.gallery as string[])
    : [];
  const paths = gallery
    .map((u) => storagePathFromUrl(u))
    .filter((p): p is string => !!p);

  // Exclui no banco primeiro (cascata remove variantes/preços/estoque/conteúdo).
  const { error: delErr } = await admin.from("products").delete().eq("id", id);
  if (delErr) {
    revalidateProduct(id);
    return; // não remove as imagens se a exclusão falhou
  }

  // Só então remove as imagens do Storage (best-effort).
  if (paths.length) await admin.storage.from(BUCKET).remove(paths);

  await logAudit(actor, {
    action: "product.delete",
    entityType: "product",
    entityId: id,
  });
  revalidateProduct(id);
  redirect("/admin");
}

export async function saveVariantAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await getAdminUser();
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (serviceRoleMissing())
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const productId = String(formData.get("productId") ?? "");
  const variantId = String(formData.get("variantId") ?? "").trim();
  const size = String(formData.get("size") ?? "").trim().toUpperCase() || null;
  const price = parsePrice(formData.get("price"));
  const qty = parseQty(formData.get("qty"));
  if (!productId) return { ok: false, error: "Produto inválido." };
  if (!Number.isFinite(price) || price <= 0)
    return { ok: false, error: "Informe um preço válido." };

  const admin = createAdminClient();
  let vId = variantId;

  if (vId) {
    await admin.from("product_variants").update({ size }).eq("id", vId);
  } else {
    const { data: created } = await admin
      .from("product_variants")
      .insert({
        microvix_id: `manual-${randomUUID()}`,
        product_id: productId,
        size,
        color: null,
      })
      .select("id")
      .single();
    if (!created) return { ok: false, error: "Erro ao criar a variante." };
    vId = created.id;
  }

  await admin
    .from("prices")
    .upsert(
      { variant_id: vId, tabela_id: "default", price },
      { onConflict: "variant_id,tabela_id" },
    );
  await admin
    .from("stock_cache")
    .upsert(
      { variant_id: vId, deposito_id: "loja", qty_available: qty },
      { onConflict: "variant_id,deposito_id" },
    );

  await logAudit(actor, {
    action: "variant.save",
    entityType: "product",
    entityId: productId,
    metadata: { variantId: vId, size, price, qty },
  });
  revalidateProduct(productId);
  return { ok: true };
}

export async function deleteVariantAction(formData: FormData): Promise<void> {
  const actor = await getAdminUser();
  if (!actor) return;
  if (serviceRoleMissing()) return;

  const productId = String(formData.get("productId") ?? "");
  const variantId = String(formData.get("variantId") ?? "");
  if (!variantId) return;

  const admin = createAdminClient();
  await admin.from("product_variants").delete().eq("id", variantId);
  await logAudit(actor, {
    action: "variant.delete",
    entityType: "product",
    entityId: productId,
    metadata: { variantId },
  });
  revalidateProduct(productId);
}

/**
 * Gera URLs de upload ASSINADAS para o navegador enviar as imagens DIRETO ao
 * Storage do Supabase, sem trafegar os bytes pela Server Action. O corpo de uma
 * Server Action é limitado a 1 MB no Next e a 4,5 MB na Vercel; várias fotos de
 * celular estouram esses limites e derrubavam a página. Só um admin autenticado
 * consegue gerar os alvos; o caminho é reconstruído no servidor no commit.
 */
export async function createUploadUrlsAction(
  files: { name: string }[],
  folder: string,
): Promise<{ ok: boolean; error?: string; targets?: UploadTarget[] }> {
  const actor = await getAdminUser();
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (serviceRoleMissing())
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };
  if (!Array.isArray(files) || files.length === 0)
    return { ok: false, error: "Selecione ao menos uma imagem." };
  if (files.length > 30)
    return { ok: false, error: "Máximo de 30 imagens por vez." };

  const safeFolder = /^[A-Za-z0-9_-]+$/.test(folder) ? folder : "pending";
  const admin = createAdminClient();
  const targets: UploadTarget[] = [];
  for (const f of files) {
    const rawExt = (f?.name?.split(".").pop() ?? "").toLowerCase();
    const ext = ALLOWED_EXT.has(rawExt) ? rawExt : "jpg";
    const path = `${safeFolder}/${randomUUID()}.${ext}`;
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data)
      return { ok: false, error: "Erro ao preparar o envio das imagens." };
    targets.push({ path: data.path, token: data.token });
  }
  return { ok: true, targets };
}

/**
 * Confirma as fotos já enviadas ao Storage (pelo navegador, via URLs assinadas)
 * e as anexa à galeria do produto. Recebe apenas os CAMINHOS; a URL pública é
 * remontada no servidor para não confiar em URL vinda do cliente.
 */
export async function commitPhotosAction(
  productId: string,
  paths: string[],
): Promise<ActionResult> {
  const actor = await getAdminUser();
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (serviceRoleMissing())
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };
  if (!productId) return { ok: false, error: "Produto inválido." };

  const safePaths = (Array.isArray(paths) ? paths : []).filter(isSafeStoragePath);
  if (safePaths.length === 0)
    return { ok: false, error: "Nenhuma imagem para salvar." };

  const admin = createAdminClient();
  await ensureProductContent(admin, productId);
  const { data: content } = await admin
    .from("product_content")
    .select("gallery")
    .eq("product_id", productId)
    .maybeSingle();
  const gallery = Array.isArray(content?.gallery)
    ? (content!.gallery as string[])
    : [];
  const urls = safePaths.map((p) => publicUrlForPath(admin, p));

  await admin
    .from("product_content")
    .update({ gallery: [...gallery, ...urls] })
    .eq("product_id", productId);
  await logAudit(actor, {
    action: "photo.add",
    entityType: "product",
    entityId: productId,
    metadata: { count: urls.length },
  });
  revalidateProduct(productId);
  return { ok: true };
}

export async function removePhotoAction(formData: FormData): Promise<void> {
  const actor = await getAdminUser();
  if (!actor) return;
  if (serviceRoleMissing()) return;

  const productId = String(formData.get("productId") ?? "");
  const url = String(formData.get("url") ?? "");
  if (!productId || !url) return;

  const admin = createAdminClient();
  await ensureProductContent(admin, productId);
  const { data: content } = await admin
    .from("product_content")
    .select("gallery")
    .eq("product_id", productId)
    .maybeSingle();
  const gallery = Array.isArray(content?.gallery)
    ? (content!.gallery as string[])
    : [];

  await admin
    .from("product_content")
    .update({ gallery: gallery.filter((u) => u !== url) })
    .eq("product_id", productId);

  const path = storagePathFromUrl(url);
  if (path) await admin.storage.from(BUCKET).remove([path]);

  await logAudit(actor, {
    action: "photo.remove",
    entityType: "product",
    entityId: productId,
  });
  revalidateProduct(productId);
}
