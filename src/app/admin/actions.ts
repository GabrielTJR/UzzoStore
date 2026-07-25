"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminUser, slugify } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CreateProductResult = { ok: boolean; error?: string };

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function createProductAction(
  _prev: CreateProductResult | null,
  formData: FormData,
): Promise<CreateProductResult> {
  const user = await getAdminUser();
  if (!user) return { ok: false, error: "Não autorizado." };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      error:
        "Falta configurar SUPABASE_SERVICE_ROLE_KEY no servidor (.env.local / Vercel).",
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  const categoryName = String(formData.get("category") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const price = Number(String(formData.get("price") ?? "").replace(",", "."));
  const sizes = String(formData.get("sizes") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const description = String(formData.get("description") ?? "").trim() || null;
  const image = formData.get("image");

  if (!name) return { ok: false, error: "Informe o nome do produto." };
  if (!Number.isFinite(price) || price <= 0)
    return { ok: false, error: "Informe um preço válido." };
  if (sizes.length === 0)
    return { ok: false, error: "Informe ao menos um tamanho (ex.: P, M, G)." };

  const admin = createAdminClient();

  // Categoria: buscar por nome; criar se não existir.
  let categoryId: string | null = null;
  if (categoryName) {
    const { data: cat } = await admin
      .from("categories")
      .select("id")
      .eq("name", categoryName)
      .maybeSingle();
    if (cat) {
      categoryId = cat.id;
    } else {
      const { data: newCat } = await admin
        .from("categories")
        .insert({
          microvix_id: `manual-cat-${randomUUID()}`,
          name: categoryName,
          kind: "setor",
        })
        .select("id")
        .single();
      categoryId = newCat?.id ?? null;
    }
  }

  // Produto
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

  // Variantes + preço + estoque (estoque local; será reconciliado pelo Microvix depois)
  for (const size of sizes) {
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

  // Imagem (opcional) -> Supabase Storage
  let gallery: string[] = [];
  if (image instanceof File && image.size > 0) {
    const ext = image.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${product.id}/${randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("product-images")
      .upload(path, image, { contentType: image.type || "image/jpeg" });
    if (!upErr) {
      const { data: pub } = admin.storage
        .from("product-images")
        .getPublicUrl(path);
      gallery = [pub.publicUrl];
    }
  }

  // Conteúdo/SEO com slug único
  let slug = slugify(name) || `produto-${product.id.slice(0, 8)}`;
  const { data: existing } = await admin
    .from("product_content")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) slug = `${slug}-${product.id.slice(0, 8)}`;

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

  revalidatePath("/produtos");
  revalidatePath("/admin");
  redirect(`/produtos/${slug}`);
}
