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
