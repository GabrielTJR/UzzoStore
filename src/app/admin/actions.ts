"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminUser, slugify } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { isHomeSectionKind, KIND_LABEL } from "@/lib/home-sections";
import { isOrderStatus } from "@/lib/admin-orders";
import { sendOrderStatusEmail } from "@/lib/email";
import type { Json } from "@/lib/supabase/database.types";

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

/** Preço opcional: vazio => null; inválido => undefined (erro). */
function parseOptionalPrice(
  raw: FormDataEntryValue | null,
): number | null | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = parsePrice(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
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

/** Get-or-create de uma cor no cadastro GERAL (match case-insensitive por nome). */
async function resolveColorId(
  admin: AdminClient,
  name: string,
  hex?: string | null,
): Promise<string | null> {
  const clean = name.trim();
  if (!clean) return null;
  const { data: existing } = await admin
    .from("colors")
    .select("id")
    .ilike("name", clean)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created } = await admin
    .from("colors")
    .insert({ name: clean, hex: hex && hex.trim() ? hex.trim() : null })
    .select("id")
    .single();
  return created?.id ?? null;
}

/** Descobre o product_id a partir de um product_colors.id. */
async function productIdFromColor(
  admin: AdminClient,
  productColorId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("product_colors")
    .select("product_id")
    .eq("id", productColorId)
    .maybeSingle();
  return data?.product_id ?? null;
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
  revalidatePath("/produtos/[slug]", "page");
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
  const promo = parseOptionalPrice(formData.get("promoPrice"));
  const sizes = String(formData.get("sizes") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const description = String(formData.get("description") ?? "").trim() || null;

  // Cores: escolhidas do cadastro geral (colorIds) e/ou criadas na hora (newColors).
  const colorIds = formData
    .getAll("colorIds")
    .map((c) => String(c))
    .filter(Boolean);
  const newColors = String(formData.get("newColors") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!name) return { ok: false, error: "Informe o nome do produto." };
  if (!Number.isFinite(price) || price <= 0)
    return { ok: false, error: "Informe um preço válido." };
  if (promo === undefined)
    return { ok: false, error: "Preço promocional inválido." };

  const admin = createAdminClient();

  // Resolve as cores (cadastro geral). Deduplica preservando a ordem.
  const resolvedColorIds: string[] = [];
  const seen = new Set<string>();
  for (const id of colorIds) {
    if (!seen.has(id)) {
      seen.add(id);
      resolvedColorIds.push(id);
    }
  }
  for (const cname of newColors) {
    const id = await resolveColorId(admin, cname);
    if (id && !seen.has(id)) {
      seen.add(id);
      resolvedColorIds.push(id);
    }
  }
  if (resolvedColorIds.length === 0)
    return { ok: false, error: "Selecione ou crie ao menos uma cor." };

  // Nomes das cores (para o campo texto `color` — compatível com o Microvix).
  const { data: colorRows } = await admin
    .from("colors")
    .select("id, name")
    .in("id", resolvedColorIds);
  const colorNameById = new Map(
    (colorRows ?? []).map((c) => [c.id, c.name] as const),
  );

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
      price,
      promo_price: promo,
    })
    .select("id")
    .single();
  if (prodErr || !product)
    return { ok: false, error: "Erro ao criar o produto." };

  // Sem tamanhos: uma variante única (peça única) por cor.
  const variantSizes = sizes.length ? sizes : [null];

  let sortOrder = 0;
  for (const colorId of resolvedColorIds) {
    const { data: pColor } = await admin
      .from("product_colors")
      .insert({
        product_id: product.id,
        color_id: colorId,
        gallery: [],
        sort_order: sortOrder++,
      })
      .select("id")
      .single();
    if (!pColor) continue;
    const colorName = colorNameById.get(colorId) ?? null;
    for (const size of variantSizes) {
      const { data: variant } = await admin
        .from("product_variants")
        .insert({
          microvix_id: `manual-${randomUUID()}`,
          product_id: product.id,
          product_color_id: pColor.id,
          size,
          color: colorName,
        })
        .select("id")
        .single();
      if (!variant) continue;
      await admin.from("stock_cache").insert({
        variant_id: variant.id,
        deposito_id: "loja",
        qty_available: 0,
      });
    }
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
    gallery: [],
  });

  await logAudit(actor, {
    action: "product.create",
    entityType: "product",
    entityId: product.id,
    entityLabel: name,
    metadata: { price, promo, sizes, colors: resolvedColorIds.length },
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
  const price = parsePrice(formData.get("price"));
  const promo = parseOptionalPrice(formData.get("promoPrice"));
  const active = formData.get("active") === "on";
  const featured = formData.get("featured") === "on";
  const measurementModelId =
    String(formData.get("measurementModelId") ?? "").trim() || null;

  if (!id) return { ok: false, error: "Produto inválido." };
  if (!name) return { ok: false, error: "Informe o nome do produto." };
  if (!Number.isFinite(price) || price <= 0)
    return { ok: false, error: "Informe um preço válido." };
  if (promo === undefined)
    return { ok: false, error: "Preço promocional inválido." };

  const admin = createAdminClient();
  const categoryId = await resolveCategoryId(admin, categoryName);

  const { error: prodErr } = await admin
    .from("products")
    .update({
      name,
      reference,
      category_id: categoryId,
      active_ecommerce: active,
      price,
      promo_price: promo,
      measurement_model_id: measurementModelId,
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
    metadata: { active, featured, price, promo },
  });
  revalidateProduct(id);
  return { ok: true };
}

/** Liga/desliga o "destaque na home" de um produto (mesma função do checkbox da edição). */
export async function toggleFeaturedAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await getAdminUser();
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (serviceRoleMissing())
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const id = String(formData.get("productId") ?? "");
  if (!id) return { ok: false, error: "Produto inválido." };

  const admin = createAdminClient();
  await ensureProductContent(admin, id);
  const { data } = await admin
    .from("product_content")
    .select("featured")
    .eq("product_id", id)
    .maybeSingle();
  const next = !(data?.featured ?? false);

  const { error } = await admin
    .from("product_content")
    .update({ featured: next })
    .eq("product_id", id);
  if (error) return { ok: false, error: "Erro ao atualizar o destaque." };

  await logAudit(actor, {
    action: "product.featured",
    entityType: "product",
    entityId: id,
    metadata: { featured: next },
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

  // Coleta os caminhos das imagens ANTES de excluir (galerias por cor + legado).
  const paths: string[] = [];
  const { data: pColors } = await admin
    .from("product_colors")
    .select("gallery")
    .eq("product_id", id);
  for (const c of pColors ?? []) {
    const g = Array.isArray(c.gallery) ? (c.gallery as string[]) : [];
    for (const u of g) {
      const p = storagePathFromUrl(u);
      if (p) paths.push(p);
    }
  }
  const { data: content } = await admin
    .from("product_content")
    .select("gallery")
    .eq("product_id", id)
    .maybeSingle();
  const legacy = Array.isArray(content?.gallery)
    ? (content!.gallery as string[])
    : [];
  for (const u of legacy) {
    const p = storagePathFromUrl(u);
    if (p) paths.push(p);
  }

  // Exclui no banco primeiro (cascata remove cores/variantes/preços/estoque/conteúdo).
  const { error: delErr } = await admin.from("products").delete().eq("id", id);
  if (delErr) {
    revalidateProduct(id);
    return; // não remove as imagens se a exclusão falhou
  }

  if (paths.length) await admin.storage.from(BUCKET).remove(paths);

  await logAudit(actor, {
    action: "product.delete",
    entityType: "product",
    entityId: id,
  });
  revalidateProduct(id);
  redirect("/admin");
}

// --- Cores DO PRODUTO -------------------------------------------------------

/** Atribui uma cor (do cadastro geral ou nova) a um produto. */
export async function addProductColorAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await getAdminUser();
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (serviceRoleMissing())
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const productId = String(formData.get("productId") ?? "");
  const existingId = String(formData.get("colorId") ?? "").trim();
  const newName = String(formData.get("newColorName") ?? "").trim();
  const newHex = String(formData.get("newColorHex") ?? "").trim();
  if (!productId) return { ok: false, error: "Produto inválido." };

  const admin = createAdminClient();

  let colorId: string | null = null;
  if (existingId && existingId !== "__new__") {
    colorId = existingId;
  } else if (newName) {
    colorId = await resolveColorId(admin, newName, newHex || null);
  }
  if (!colorId)
    return { ok: false, error: "Escolha uma cor ou informe o nome da nova." };

  // Já existe essa cor no produto?
  const { data: dup } = await admin
    .from("product_colors")
    .select("id")
    .eq("product_id", productId)
    .eq("color_id", colorId)
    .maybeSingle();
  if (dup) return { ok: false, error: "Essa cor já está no produto." };

  const { count } = await admin
    .from("product_colors")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  const { error } = await admin.from("product_colors").insert({
    product_id: productId,
    color_id: colorId,
    gallery: [],
    sort_order: count ?? 0,
  });
  if (error) return { ok: false, error: "Erro ao adicionar a cor." };

  await logAudit(actor, {
    action: "product_color.add",
    entityType: "product",
    entityId: productId,
    metadata: { colorId },
  });
  revalidateProduct(productId);
  return { ok: true };
}

/** Remove uma cor do produto (com suas variantes/estoque e fotos). */
export async function removeProductColorAction(
  formData: FormData,
): Promise<void> {
  const actor = await getAdminUser();
  if (!actor) return;
  if (serviceRoleMissing()) return;

  const productId = String(formData.get("productId") ?? "");
  const productColorId = String(formData.get("productColorId") ?? "");
  if (!productColorId) return;

  const admin = createAdminClient();

  const { data: pColor } = await admin
    .from("product_colors")
    .select("gallery")
    .eq("id", productColorId)
    .maybeSingle();
  const gallery = Array.isArray(pColor?.gallery)
    ? (pColor!.gallery as string[])
    : [];
  const paths = gallery
    .map((u) => storagePathFromUrl(u))
    .filter((p): p is string => !!p);

  const { error } = await admin
    .from("product_colors")
    .delete()
    .eq("id", productColorId);
  if (error) {
    revalidateProduct(productId);
    return;
  }

  if (paths.length) await admin.storage.from(BUCKET).remove(paths);

  await logAudit(actor, {
    action: "product_color.remove",
    entityType: "product",
    entityId: productId,
    metadata: { productColorId },
  });
  revalidateProduct(productId);
}

// --- Variantes (tamanho + estoque, por cor) ---------------------------------

export async function saveVariantAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await getAdminUser();
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (serviceRoleMissing())
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const productId = String(formData.get("productId") ?? "");
  const productColorId = String(formData.get("productColorId") ?? "").trim();
  const variantId = String(formData.get("variantId") ?? "").trim();
  const size = String(formData.get("size") ?? "").trim().toUpperCase() || null;
  const qty = parseQty(formData.get("qty"));
  if (!productId) return { ok: false, error: "Produto inválido." };
  if (!productColorId && !variantId)
    return { ok: false, error: "Cor inválida." };

  const admin = createAdminClient();
  let vId = variantId;

  if (vId) {
    const { error: updErr } = await admin
      .from("product_variants")
      .update({ size })
      .eq("id", vId);
    if (updErr)
      return { ok: false, error: "Já existe esse tamanho nessa cor." };
  } else {
    // Nome da cor para preencher o campo texto (compatível com o Microvix).
    const { data: pColor } = await admin
      .from("product_colors")
      .select("colors ( name )")
      .eq("id", productColorId)
      .maybeSingle();
    const colorName =
      (pColor as { colors: { name: string } | null } | null)?.colors?.name ??
      null;

    const { data: created, error: insErr } = await admin
      .from("product_variants")
      .insert({
        microvix_id: `manual-${randomUUID()}`,
        product_id: productId,
        product_color_id: productColorId,
        size,
        color: colorName,
      })
      .select("id")
      .single();
    if (insErr || !created)
      return {
        ok: false,
        error: "Erro ao criar o tamanho (talvez já exista nessa cor).",
      };
    vId = created.id;
  }

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
    metadata: { variantId: vId, productColorId, size, qty },
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

// --- Cadastro GERAL de cores ------------------------------------------------

export async function createColorAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await getAdminUser();
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (serviceRoleMissing())
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const name = String(formData.get("name") ?? "").trim();
  const hex = String(formData.get("hex") ?? "").trim() || null;
  if (!name) return { ok: false, error: "Informe o nome da cor." };

  const admin = createAdminClient();
  const { data: dup } = await admin
    .from("colors")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (dup) return { ok: false, error: "Já existe uma cor com esse nome." };

  const { error } = await admin.from("colors").insert({ name, hex });
  if (error) return { ok: false, error: "Erro ao criar a cor." };

  await logAudit(actor, {
    action: "color.create",
    entityType: "color",
    entityLabel: name,
  });
  revalidatePath("/admin/cores");
  return { ok: true };
}

export async function updateColorAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await getAdminUser();
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (serviceRoleMissing())
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const id = String(formData.get("colorId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const hex = String(formData.get("hex") ?? "").trim() || null;
  if (!id) return { ok: false, error: "Cor inválida." };
  if (!name) return { ok: false, error: "Informe o nome da cor." };

  const admin = createAdminClient();
  const { data: dup } = await admin
    .from("colors")
    .select("id")
    .ilike("name", name)
    .neq("id", id)
    .maybeSingle();
  if (dup) return { ok: false, error: "Já existe uma cor com esse nome." };

  const { error } = await admin
    .from("colors")
    .update({ name, hex, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "Erro ao salvar a cor." };

  await logAudit(actor, {
    action: "color.update",
    entityType: "color",
    entityId: id,
    entityLabel: name,
  });
  revalidatePath("/admin/cores");
  revalidatePath("/produtos");
  return { ok: true };
}

export async function deleteColorAction(formData: FormData): Promise<void> {
  const actor = await getAdminUser();
  if (!actor) return;
  if (serviceRoleMissing()) return;

  const id = String(formData.get("colorId") ?? "");
  if (!id) return;

  const admin = createAdminClient();
  // FK on delete restrict: se a cor estiver em uso por algum produto, a
  // exclusão falha — não registramos auditoria de algo que não aconteceu.
  const { error } = await admin.from("colors").delete().eq("id", id);
  if (error) {
    revalidatePath("/admin/cores");
    return;
  }
  await logAudit(actor, {
    action: "color.delete",
    entityType: "color",
    entityId: id,
  });
  revalidatePath("/admin/cores");
}

// --- Categorias (setores) ---------------------------------------------------

function revalidateCategories() {
  revalidatePath("/admin/categorias");
  revalidatePath("/admin");
  revalidatePath("/produtos");
  revalidatePath("/");
}

export async function createCategoryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await getAdminUser();
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (serviceRoleMissing())
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Informe o nome da categoria." };

  const admin = createAdminClient();
  const { data: dup } = await admin
    .from("categories")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (dup) return { ok: false, error: "Já existe uma categoria com esse nome." };

  const { error } = await admin.from("categories").insert({
    microvix_id: `manual-cat-${randomUUID()}`,
    name,
    kind: "setor",
  });
  if (error) return { ok: false, error: "Erro ao criar a categoria." };

  await logAudit(actor, {
    action: "category.create",
    entityType: "category",
    entityLabel: name,
  });
  revalidateCategories();
  return { ok: true };
}

export async function updateCategoryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await getAdminUser();
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (serviceRoleMissing())
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const id = String(formData.get("categoryId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id) return { ok: false, error: "Categoria inválida." };
  if (!name) return { ok: false, error: "Informe o nome da categoria." };

  const admin = createAdminClient();
  const { data: dup } = await admin
    .from("categories")
    .select("id")
    .ilike("name", name)
    .neq("id", id)
    .maybeSingle();
  if (dup) return { ok: false, error: "Já existe uma categoria com esse nome." };

  const { error } = await admin
    .from("categories")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "Erro ao salvar a categoria." };

  await logAudit(actor, {
    action: "category.update",
    entityType: "category",
    entityId: id,
    entityLabel: name,
  });
  revalidateCategories();
  return { ok: true };
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const actor = await getAdminUser();
  if (!actor) return;
  if (serviceRoleMissing()) return;

  const id = String(formData.get("categoryId") ?? "");
  if (!id) return;

  const admin = createAdminClient();
  // products.category_id tem ON DELETE SET NULL: os produtos ficam sem categoria.
  const { error } = await admin.from("categories").delete().eq("id", id);
  if (error) {
    revalidateCategories();
    return;
  }
  await logAudit(actor, {
    action: "category.delete",
    entityType: "category",
    entityId: id,
  });
  revalidateCategories();
}

// --- Tabela de medidas (modelos) --------------------------------------------

function revalidateMeasurements(id?: string) {
  revalidatePath("/admin/medidas");
  if (id) revalidatePath(`/admin/medidas/${id}`);
  revalidatePath("/admin");
  revalidatePath("/produtos/[slug]", "page");
}

export async function createMeasurementModelAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await getAdminUser();
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (serviceRoleMissing())
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Informe o nome do modelo." };

  const admin = createAdminClient();
  const { data: dup } = await admin
    .from("measurement_models")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (dup) return { ok: false, error: "Já existe um modelo com esse nome." };

  const { data: created, error } = await admin
    .from("measurement_models")
    .insert({ name })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: "Erro ao criar o modelo." };

  await logAudit(actor, {
    action: "measurement_model.create",
    entityType: "measurement_model",
    entityId: created.id,
    entityLabel: name,
  });
  revalidatePath("/admin/medidas");
  redirect(`/admin/medidas/${created.id}`);
}

export async function saveMeasurementModelAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await getAdminUser();
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (serviceRoleMissing())
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const id = String(formData.get("modelId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id) return { ok: false, error: "Modelo inválido." };
  if (!name) return { ok: false, error: "Informe o nome do modelo." };

  // Colunas/linhas/avisos chegam serializados em JSON no campo `payload`.
  let columns: string[] = [];
  let rows: { size: string; values: string[] }[] = [];
  let noteTop: string | null = null;
  let noteBottom: string | null = null;
  try {
    const p = JSON.parse(String(formData.get("payload") ?? "{}"));
    columns = (Array.isArray(p.columns) ? p.columns : [])
      .map((c: unknown) => String(c ?? "").trim())
      .filter((c: string) => c.length > 0);
    const colCount = columns.length;
    rows = (Array.isArray(p.rows) ? p.rows : [])
      .map((r: { size?: unknown; values?: unknown }) => ({
        size: String(r?.size ?? "").trim(),
        values: Array.from({ length: colCount }, (_, i) =>
          String((Array.isArray(r?.values) ? r.values : [])[i] ?? "").trim(),
        ),
      }))
      .filter((r: { size: string }) => r.size.length > 0);
    noteTop =
      typeof p.noteTop === "string" && p.noteTop.trim() ? p.noteTop.trim() : null;
    noteBottom =
      typeof p.noteBottom === "string" && p.noteBottom.trim()
        ? p.noteBottom.trim()
        : null;
  } catch {
    return { ok: false, error: "Dados da tabela inválidos." };
  }

  const admin = createAdminClient();
  const { data: dup } = await admin
    .from("measurement_models")
    .select("id")
    .ilike("name", name)
    .neq("id", id)
    .maybeSingle();
  if (dup) return { ok: false, error: "Já existe um modelo com esse nome." };

  const { error } = await admin
    .from("measurement_models")
    .update({
      name,
      columns,
      rows,
      note_top: noteTop,
      note_bottom: noteBottom,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Erro ao salvar o modelo." };

  await logAudit(actor, {
    action: "measurement_model.update",
    entityType: "measurement_model",
    entityId: id,
    entityLabel: name,
  });
  revalidateMeasurements(id);
  return { ok: true };
}

export async function deleteMeasurementModelAction(
  formData: FormData,
): Promise<void> {
  const actor = await getAdminUser();
  if (!actor) return;
  if (serviceRoleMissing()) return;

  const id = String(formData.get("modelId") ?? "");
  if (!id) return;

  const admin = createAdminClient();
  // products.measurement_model_id tem ON DELETE SET NULL (produtos ficam sem tabela).
  await admin.from("measurement_models").delete().eq("id", id);
  await logAudit(actor, {
    action: "measurement_model.delete",
    entityType: "measurement_model",
    entityId: id,
  });
  revalidatePath("/admin/medidas");
  revalidatePath("/produtos/[slug]", "page");
  redirect("/admin/medidas");
}

// --- Pedidos ----------------------------------------------------------------

/** Muda a situação do pedido (Aguardando / Pago / Enviado / Cancelado). */
export async function updateOrderStatusAction(
  formData: FormData,
): Promise<void> {
  const actor = await getAdminUser();
  if (!actor) return;
  if (serviceRoleMissing()) return;

  const id = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !isOrderStatus(status)) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    revalidatePath("/admin/pedidos");
    return;
  }

  // Avisa o cliente nas etapas que importam para ele (e-mail nunca bloqueia).
  if (status === "ready" || status === "shipped" || status === "delivered") {
    const { data: order } = await admin
      .from("orders")
      .select("number, customer_id")
      .eq("id", id)
      .maybeSingle();
    if (order?.customer_id) {
      const [{ data: profile }, { data: authUser }] = await Promise.all([
        admin
          .from("customers")
          .select("full_name")
          .eq("id", order.customer_id)
          .maybeSingle(),
        admin.auth.admin.getUserById(order.customer_id),
      ]);
      const to = authUser?.user?.email;
      if (to)
        await sendOrderStatusEmail({
          to,
          customerName: profile?.full_name ?? null,
          orderNumber: order.number,
          status,
        });
    }
  }

  await logAudit(actor, {
    action: "order.status",
    entityType: "order",
    entityId: id,
    metadata: { status },
  });
  revalidatePath("/admin/pedidos");
  revalidatePath("/conta/pedidos");
}

// --- Decoração da home ------------------------------------------------------

function revalidateHome(id?: string) {
  revalidatePath("/admin/decoracao");
  if (id) revalidatePath(`/admin/decoracao/${id}`);
  revalidatePath("/", "layout"); // a faixa de aviso vive no layout
}

export async function createHomeSectionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await getAdminUser();
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (serviceRoleMissing())
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const kind = String(formData.get("kind") ?? "");
  if (!isHomeSectionKind(kind))
    return { ok: false, error: "Tipo de bloco inválido." };

  const admin = createAdminClient();
  // Posição = maior + 1. Usar o COUNT colidiria com um bloco existente depois
  // de qualquer exclusão (0,1,2 → apaga o 0 → count 2 = posição do último).
  const { data: last } = await admin
    .from("home_sections")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (last?.sort_order ?? -1) + 1;

  const defaults: Json =
    kind === "banner"
      ? { slides: [] }
      : kind === "mosaico"
        ? { cards: [] }
        : kind === "vitrine"
          ? { source: "destaques", title: "Destaques" }
          : { text: "" };

  const { data: created, error } = await admin
    .from("home_sections")
    .insert({
      kind,
      name: KIND_LABEL[kind], // o admin renomeia depois (ex.: "Banner Dia dos Pais")
      active: false, // nasce desligado: o admin monta e depois publica
      sort_order: nextOrder,
      data: defaults,
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: "Erro ao criar o bloco." };

  await logAudit(actor, {
    action: "home_section.create",
    entityType: "home_section",
    entityId: created.id,
    entityLabel: kind,
  });
  revalidateHome();
  // Sem `redirect`: o formulário fica na própria lista (redirecionar para a
  // mesma URL não recarrega). O cliente dá `router.refresh()` ao receber ok.
  return { ok: true };
}

/** Salva o conteúdo do bloco. `payload` é o JSON do editor; imagens vêm como CAMINHOS do Storage. */
export async function saveHomeSectionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await getAdminUser();
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (serviceRoleMissing())
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const id = String(formData.get("sectionId") ?? "");
  if (!id) return { ok: false, error: "Bloco inválido." };

  const admin = createAdminClient();
  const { data: current } = await admin
    .from("home_sections")
    .select("kind")
    .eq("id", id)
    .maybeSingle();
  if (!current || !isHomeSectionKind(current.kind))
    return { ok: false, error: "Bloco não encontrado." };

  // Converte caminho do Storage -> URL pública (nunca confia em URL do cliente;
  // valores que já são URL pública do nosso bucket são mantidos).
  const toUrl = (v: unknown): string | null => {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) return null;
    if (isSafeStoragePath(s)) return publicUrlForPath(admin, s);
    return storagePathFromUrl(s) ? s : null;
  };
  const text = (v: unknown): string | null => {
    const s = typeof v === "string" ? v.trim() : "";
    return s.length ? s.slice(0, 300) : null;
  };
  /** Link: só caminho interno ou http(s). Digitou "produtos" → vira "/produtos". */
  const link = (v: unknown): string | null => {
    const s = text(v);
    if (!s) return null;
    if (s.startsWith("/")) return s;
    if (/^https?:\/\//i.test(s)) return s;
    return `/${s.replace(/^\/+/, "")}`;
  };

  let data: Json;
  try {
    const p = JSON.parse(String(formData.get("payload") ?? "{}"));
    if (current.kind === "aviso") {
      data = { text: text(p.text), href: link(p.href) };
    } else if (current.kind === "banner") {
      const slides = (Array.isArray(p.slides) ? p.slides : [])
        .map((s: Record<string, unknown>) => ({
          imageDesktop: toUrl(s.imageDesktop),
          imageMobile: toUrl(s.imageMobile),
          title: text(s.title),
          subtitle: text(s.subtitle),
          buttonLabel: text(s.buttonLabel),
          buttonHref: link(s.buttonHref),
          align: s.align === "center" || s.align === "right" ? s.align : "left",
          theme: s.theme === "dark" ? "dark" : "light",
        }))
        // Slide sem imagem nenhuma não vira banner (viraria um quadro vazio).
        .filter(
          (s: { imageDesktop: string | null; imageMobile: string | null }) =>
            s.imageDesktop || s.imageMobile,
        );
      data = { slides };
    } else if (current.kind === "mosaico") {
      const cards = (Array.isArray(p.cards) ? p.cards : [])
        .map((c: Record<string, unknown>) => ({
          image: toUrl(c.image),
          label: text(c.label) ?? "",
          href: link(c.href) ?? "/produtos",
        }))
        .filter((c: { image: string | null; label: string }) => c.image || c.label);
      data = { title: text(p.title), cards };
    } else {
      const n = Number(p.limit);
      const src =
        p.source === "promo" || p.source === "categoria"
          ? p.source
          : "destaques";
      const categoryId = text(p.categoryId);
      // Sem categoria escolhida a vitrine mostraria o catálogo inteiro.
      if (src === "categoria" && !categoryId)
        return { ok: false, error: "Escolha a categoria da vitrine." };
      data = {
        title: text(p.title),
        source: src,
        categoryId,
        limit: Number.isFinite(n) && n > 0 ? Math.min(n, 12) : null,
      };
    }
  } catch {
    return { ok: false, error: "Dados do bloco inválidos." };
  }

  const name = text(formData.get("name")) ?? KIND_LABEL[current.kind];

  const { error } = await admin
    .from("home_sections")
    .update({ name, data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "Erro ao salvar o bloco." };

  await logAudit(actor, {
    action: "home_section.update",
    entityType: "home_section",
    entityId: id,
    entityLabel: current.kind,
  });
  revalidateHome(id);
  redirect("/admin/decoracao"); // volta para a lista após salvar
}

export async function toggleHomeSectionAction(
  formData: FormData,
): Promise<void> {
  const actor = await getAdminUser();
  if (!actor) return;
  if (serviceRoleMissing()) return;

  const id = String(formData.get("sectionId") ?? "");
  if (!id) return;

  const admin = createAdminClient();
  const { data } = await admin
    .from("home_sections")
    .select("active")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;

  const { error } = await admin
    .from("home_sections")
    .update({ active: !data.active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    revalidateHome(id);
    return;
  }
  await logAudit(actor, {
    action: "home_section.toggle",
    entityType: "home_section",
    entityId: id,
    metadata: { active: !data.active },
  });
  revalidateHome(id);
  // Nada de `redirect` aqui: a ação é disparada DA PRÓPRIA lista, e redirecionar
  // para a mesma URL é no-op (o router reusa o cache). Quem atualiza a tela é o
  // `router.refresh()` no cliente — ver SectionRowActions.
}

/** Move o bloco uma posição para cima (-1) ou para baixo (+1), trocando com o vizinho. */
export async function moveHomeSectionAction(formData: FormData): Promise<void> {
  const actor = await getAdminUser();
  if (!actor) return;
  if (serviceRoleMissing()) return;

  const id = String(formData.get("sectionId") ?? "");
  const dir = String(formData.get("dir") ?? "");
  if (!id || (dir !== "up" && dir !== "down")) return;

  const admin = createAdminClient();
  const { data: all } = await admin
    .from("home_sections")
    .select("id, sort_order")
    .order("sort_order")
    .order("created_at"); // mesma ordem que o admin está vendo
  if (!all) return;

  const i = all.findIndex((s) => s.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= all.length) return;

  // Reescreve a ordem inteira (0..n-1) com os dois vizinhos trocados — evita
  // depender dos valores atuais, que podem ter empates.
  const order = all.map((s) => s.id);
  [order[i], order[j]] = [order[j], order[i]];
  for (let k = 0; k < order.length; k++) {
    await admin
      .from("home_sections")
      .update({ sort_order: k })
      .eq("id", order[k]);
  }

  await logAudit(actor, {
    action: "home_section.move",
    entityType: "home_section",
    entityId: id,
    metadata: { dir },
  });
  revalidateHome();
  // Idem ao toggle: quem recarrega a lista é o `router.refresh()` no cliente.
}

export async function deleteHomeSectionAction(
  formData: FormData,
): Promise<void> {
  const actor = await getAdminUser();
  if (!actor) return;
  if (serviceRoleMissing()) return;

  const id = String(formData.get("sectionId") ?? "");
  if (!id) return;

  const admin = createAdminClient();
  const { error } = await admin.from("home_sections").delete().eq("id", id);
  if (error) {
    revalidateHome(id);
    return;
  }
  await logAudit(actor, {
    action: "home_section.delete",
    entityType: "home_section",
    entityId: id,
  });
  revalidateHome();
  redirect("/admin/decoracao");
}

// --- Fotos (por cor) --------------------------------------------------------

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
 * Confirma as fotos já enviadas ao Storage e as anexa à galeria DA COR.
 * Recebe apenas os CAMINHOS; a URL pública é remontada no servidor para não
 * confiar em URL vinda do cliente.
 */
export async function commitPhotosAction(
  productColorId: string,
  paths: string[],
): Promise<ActionResult> {
  const actor = await getAdminUser();
  if (!actor) return { ok: false, error: "Não autorizado." };
  if (serviceRoleMissing())
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor." };
  if (!productColorId) return { ok: false, error: "Cor inválida." };

  const safePaths = (Array.isArray(paths) ? paths : []).filter(isSafeStoragePath);
  if (safePaths.length === 0)
    return { ok: false, error: "Nenhuma imagem para salvar." };

  const admin = createAdminClient();
  const { data: pColor } = await admin
    .from("product_colors")
    .select("product_id, gallery")
    .eq("id", productColorId)
    .maybeSingle();
  if (!pColor) return { ok: false, error: "Cor não encontrada." };

  const gallery = Array.isArray(pColor.gallery)
    ? (pColor.gallery as string[])
    : [];
  const urls = safePaths.map((p) => publicUrlForPath(admin, p));

  const { error: updErr } = await admin
    .from("product_colors")
    .update({ gallery: [...gallery, ...urls] })
    .eq("id", productColorId);
  if (updErr) return { ok: false, error: "Erro ao salvar as fotos." };
  await logAudit(actor, {
    action: "photo.add",
    entityType: "product",
    entityId: pColor.product_id,
    metadata: { productColorId, count: urls.length },
  });
  revalidateProduct(pColor.product_id);
  return { ok: true };
}

export async function removePhotoAction(formData: FormData): Promise<void> {
  const actor = await getAdminUser();
  if (!actor) return;
  if (serviceRoleMissing()) return;

  const productColorId = String(formData.get("productColorId") ?? "");
  const url = String(formData.get("url") ?? "");
  if (!productColorId || !url) return;

  const admin = createAdminClient();
  const { data: pColor } = await admin
    .from("product_colors")
    .select("product_id, gallery")
    .eq("id", productColorId)
    .maybeSingle();
  if (!pColor) return;

  const gallery = Array.isArray(pColor.gallery)
    ? (pColor.gallery as string[])
    : [];

  const { error: updErr } = await admin
    .from("product_colors")
    .update({ gallery: gallery.filter((u) => u !== url) })
    .eq("id", productColorId);
  if (updErr) {
    // Não remove do Storage se a galeria não foi atualizada (evita imagem quebrada).
    revalidateProduct(pColor.product_id);
    return;
  }

  const path = storagePathFromUrl(url);
  if (path) await admin.storage.from(BUCKET).remove([path]);

  await logAudit(actor, {
    action: "photo.remove",
    entityType: "product",
    entityId: pColor.product_id,
    metadata: { productColorId },
  });
  revalidateProduct(pColor.product_id);
}
