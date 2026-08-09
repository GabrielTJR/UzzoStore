"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/customer";

export type ActionResult = { ok: boolean; error?: string };

function text(v: FormDataEntryValue | null, max = 120): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s.slice(0, max) : null;
}

/** Dados pessoais (nome, telefone, CPF). RLS garante que é a própria linha. */
export async function updateProfileAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entre na sua conta novamente." };

  const fullName = text(formData.get("fullName"));
  if (!fullName) return { ok: false, error: "Informe seu nome." };

  const supabase = await createClient();
  const { error } = await supabase.from("customers").upsert({
    id: user.id,
    full_name: fullName,
    phone: text(formData.get("phone"), 30),
    cpf: text(formData.get("cpf"), 20),
  });
  if (error) return { ok: false, error: "Não foi possível salvar os dados." };

  // Mantém o nome também no cadastro de login (usado em saudações).
  await supabase.auth.updateUser({ data: { full_name: fullName } });

  revalidatePath("/conta");
  return { ok: true };
}

/** Troca de senha do cliente logado. */
export async function changeCustomerPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8)
    return { ok: false, error: "A senha deve ter ao menos 8 caracteres." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta novamente." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: "Não foi possível trocar a senha." };
  return { ok: true };
}

/** Cria ou atualiza um endereço. `addressId` vazio = novo. */
export async function saveAddressAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entre na sua conta novamente." };

  const id = String(formData.get("addressId") ?? "").trim();
  const cep = text(formData.get("cep"), 12);
  const street = text(formData.get("street"));
  const city = text(formData.get("city"));
  const state = text(formData.get("state"), 2);
  if (!cep || !street || !city || !state)
    return { ok: false, error: "Preencha CEP, rua, cidade e estado." };

  const isDefault = formData.get("isDefault") === "on";
  const row = {
    customer_id: user.id,
    label: text(formData.get("label"), 40),
    cep,
    street,
    number: text(formData.get("number"), 20),
    complement: text(formData.get("complement")),
    district: text(formData.get("district")),
    city,
    state: state.toUpperCase(),
    is_default: isDefault,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("addresses").update(row).eq("id", id)
    : await supabase.from("addresses").insert(row);
  if (error) return { ok: false, error: "Não foi possível salvar o endereço." };

  // Só um principal por cliente.
  if (isDefault) {
    let q = supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("customer_id", user.id);
    if (id) q = q.neq("id", id);
    await q;
    if (!id) {
      // Recém-criado: garante que o principal seja ele (o mais novo).
      const { data: latest } = await supabase
        .from("addresses")
        .select("id")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest)
        await supabase
          .from("addresses")
          .update({ is_default: true })
          .eq("id", latest.id);
    }
  }

  revalidatePath("/conta/enderecos");
  return { ok: true };
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("addressId") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("addresses").delete().eq("id", id);
  revalidatePath("/conta/enderecos");
}

/**
 * O cliente cancela o próprio pedido — só enquanto está "aguardando".
 *
 * Escreve com service_role porque `orders` não tem policy de UPDATE (a
 * migração 0001 deixa a escrita só do servidor). Por isso a checagem de dono
 * e de situação é feita AQUI, explicitamente: sem RLS para nos proteger, quem
 * garante que ninguém cancela o pedido de outro é este código.
 */
export async function cancelOrderAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const id = String(formData.get("orderId") ?? "");
  if (!id) return;

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, customer_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!order) return;
  if (order.customer_id !== user.id) return; // pedido de outra pessoa
  if (order.status !== "pending") return; // já pago/enviado: não cancela

  await admin
    .from("orders")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/conta/pedidos");
  revalidatePath("/admin/pedidos");
}

export async function signOutCustomerAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
