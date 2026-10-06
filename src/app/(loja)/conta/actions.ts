"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelarPedidoPendente } from "@/lib/stock";
import { CACHE_TAGS } from "@/lib/products";
import { infinitepayHandle, linkDoPedido } from "@/lib/infinitepay";
import { freiaIp } from "@/lib/rate-limit";
import { temFolgaParaPagar } from "./pedidos/pode-pagar";
import { getCurrentUser } from "@/lib/customer";
import { isValidCep, isValidUf } from "@/lib/customer-fields";
import { formatCpf, formatPhone } from "@/lib/customer-fields";

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

  // Vazio continua permitido aqui (a conta não é o checkout), mas preenchido
  // tem de ser válido: um CPF "1" gravado em /conta pararia o cliente no
  // checkout sem ele entender por quê. Grava já formatado — a mesma regra do
  // checkout (`customer-fields.ts`), para os dois caminhos não divergirem.
  const cpfRaw = text(formData.get("cpf"), 20);
  const phoneRaw = text(formData.get("phone"), 30);
  const cpf = cpfRaw ? formatCpf(cpfRaw) : null;
  if (cpfRaw && !cpf)
    return { ok: false, error: "CPF inválido. Confira os números." };
  const phone = phoneRaw ? formatPhone(phoneRaw) : null;
  if (phoneRaw && !phone)
    return { ok: false, error: "Telefone inválido. Use DDD e número." };

  const supabase = await createClient();
  const { error } = await supabase.from("customers").upsert({
    id: user.id,
    full_name: fullName,
    phone,
    cpf,
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
  // As MESMAS regras do checkout: endereço salvo aqui com CEP incompleto ou
  // sem número só aparecia como problema na hora de pagar ("CEP incompleto").
  if (!isValidCep(cep)) return { ok: false, error: "CEP incompleto." };
  if (!isValidUf(state))
    return { ok: false, error: "Estado inválido (use a sigla, ex.: SC)." };
  if (!text(formData.get("number"), 20))
    return { ok: false, error: 'Informe o número (ou "s/n").' };

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
    .select("id, customer_id, payment_status, fulfillment_status")
    .eq("id", id)
    .maybeSingle();

  if (!order) return;
  if (order.customer_id !== user.id) return; // pedido de outra pessoa
  // Só antes de o dinheiro entrar. Depois de pago quem resolve é a loja —
  // cancelar sozinho deixaria pedido pago como cancelado, sem estorno.
  if (order.payment_status !== "pending") return;
  if (order.fulfillment_status === "canceled") return;

  // Devolve a peça reservada: o cliente desistiu, então ela volta para a
  // vitrine na hora em vez de esperar a expiração. A troca de situação é
  // condicional e vem antes da devolução (ver `cancelarPedidoPendente`) —
  // na ordem antiga, dois toques devolviam a peça duas vezes.
  if (await cancelarPedidoPendente(admin, id)) updateTag(CACHE_TAGS.catalogo); // a peça volta para a vitrine na hora

  revalidatePath("/conta/pedidos");
  revalidatePath("/admin/pedidos");
}

/** Quantas vezes o mesmo IP pode pedir "Pagar agora" em 10 min. */
const LIMITE_PAGAR_AGORA = 10;

/**
 * "Pagar agora" em Meus pedidos: leva à InfinitePay para um pedido online
 * AINDA pendente e dentro do prazo — o cliente que fechou a aba do pagamento
 * não precisa montar a sacola de novo (e não cria um segundo pedido segurando
 * a mesma peça).
 *
 * Endpoint público: o dono do pedido sai da SESSÃO e é conferido aqui com
 * service_role (sem RLS para proteger, quem garante é este código), e há
 * freio por IP porque a falta de link guardado vira chamada à InfinitePay.
 *
 * O valor cobrado é o do pedido gravado — nada é recalculado: preço, frete e
 * cupom foram decididos (e relidos no servidor) quando o pedido nasceu, e a
 * peça está reservada para ele. O prazo NÃO é esticado: reserva e expiração
 * andam juntas.
 */
export async function payPendingOrderAction(
  orderId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entre na sua conta novamente." };
  if (!infinitepayHandle() || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return { ok: false, error: "Pagamento online indisponível no momento." };

  const id = String(orderId ?? "").trim();
  if (!id || id.length > 64)
    return { ok: false, error: "Pedido não encontrado." };

  if (await freiaIp("order.pay_again", LIMITE_PAGAR_AGORA))
    return {
      ok: false,
      error: "Muitas tentativas seguidas. Aguarde alguns minutos.",
    };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, customer_id, channel, payment_status, fulfillment_status, expires_at",
    )
    .eq("id", id)
    .maybeSingle();
  // Mesma resposta para "não existe" e "é de outra pessoa": não confirma a
  // existência de pedido alheio.
  if (!order || order.customer_id !== user.id)
    return { ok: false, error: "Pedido não encontrado." };
  if (
    order.channel !== "online" ||
    order.payment_status !== "pending" ||
    order.fulfillment_status === "canceled"
  )
    return { ok: false, error: "Este pedido não está aguardando pagamento." };
  // Vencido ou quase (menos que a folga, a MESMA do checkout): o cliente
  // pagaria em 1-2 min, o pg_cron expiraria antes e a peça voltaria à vitrine
  // com o dinheiro a caminho. Cancela já, devolvendo a reserva — o pedido
  // morreria em minutos de qualquer jeito, e assim a peça volta na hora.
  if (!order.expires_at || !temFolgaParaPagar(order.expires_at, Date.now())) {
    if (await cancelarPedidoPendente(admin, id)) updateTag(CACHE_TAGS.catalogo); // a peça volta para a vitrine na hora
    revalidatePath("/conta/pedidos");
    return {
      ok: false,
      error: "O prazo deste pedido acabou. Monte a sacola de novo para pagar.",
    };
  }

  const link = await linkDoPedido(admin, id, {
    email: user.email,
    reaproveitar: true,
  });
  if (!link.ok || !link.url) {
    // Regra da casa: pendente sem link não serve para nada e prenderia a peça
    // até expirar — cancela (não apaga) e devolve a reserva.
    if (await cancelarPedidoPendente(admin, id)) updateTag(CACHE_TAGS.catalogo); // a peça volta para a vitrine na hora
    revalidatePath("/conta/pedidos");
    return {
      ok: false,
      error:
        "Não foi possível abrir o pagamento agora. O pedido foi cancelado e as peças voltaram para a loja — monte a sacola de novo para tentar.",
    };
  }
  return { ok: true, url: link.url };
}

/** Encerra a sessão. Quem chama recarrega a página (ver `SignOutButton`). */
export async function signOutCustomerAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
