"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session";
import { freiaIp } from "@/lib/rate-limit";
import type { CustomerAddress } from "@/lib/customer";
import {
  cleanText,
  formatCpf,
  formatPhone,
  isFullName,
  isValidUf,
  maskCep,
  onlyDigits,
} from "@/lib/customer-fields";

/**
 * Actions PRÓPRIAS do checkout em uma página (endereço e dados pessoais).
 *
 * Não reaproveitam as de /conta de propósito: aquelas recebem FormData, editam
 * por `addressId` e aceitam campo vazio — aqui o contrato é um objeto tipado,
 * só INSERE e exige tudo que o pagamento vai pedir. Mexer nas de /conta para
 * servir aos dois lados ampliaria a regressão na área do cliente.
 *
 * Toda action é endpoint público: a sessão é relida aqui, `id`/`customer_id`
 * saem SEMPRE dela (nunca do navegador) e a escrita usa o client de cookie —
 * o RLS ("cada um só vê o seu") é a segunda trava.
 */

const MSG_SESSAO = "Sua sessão expirou. Confirme seu e-mail de novo.";
const MSG_FREIO = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
/** Teto de endereços: o checkout só insere, então sem teto um laço encheria a
 * conta do cliente (e a lista do passo 2) de linhas iguais. */
const MAX_ENDERECOS = 10;

export type SaveAddressInput = {
  cep: string;
  street: string;
  number: string;
  complement?: string | null;
  district?: string | null;
  city: string;
  state: string;
};

export type SaveAddressResult =
  | { ok: true; address: CustomerAddress }
  | {
      ok: false;
      error: string;
      field?: "cep" | "street" | "number" | "city" | "state";
      needsLogin?: boolean;
    };

type AddressRow = {
  id: string;
  label: string | null;
  cep: string;
  street: string;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string;
  state: string;
  is_default: boolean;
};

const ADDRESS_COLS =
  "id, label, cep, street, number, complement, district, city, state, is_default";

function toAddress(a: AddressRow): CustomerAddress {
  return {
    id: a.id,
    label: a.label,
    cep: a.cep,
    street: a.street,
    number: a.number,
    complement: a.complement,
    district: a.district,
    city: a.city,
    state: a.state,
    isDefault: a.is_default,
  };
}

/** Chave de "mesmo endereço": CEP + número + complemento, sem caixa nem
 * espaços extras. Rua/cidade ficam de fora porque vêm do ViaCEP e podem vir
 * grafadas de outro jeito para o mesmo lugar. */
function chaveEndereco(
  cep: string | null,
  number: string | null,
  complement: string | null,
): string {
  return [
    onlyDigits(cep ?? ""),
    cleanText(number ?? "", 80).toLowerCase(),
    cleanText(complement ?? "", 80).toLowerCase(),
  ].join("|");
}

/**
 * Salva o endereço digitado no checkout e devolve a linha gravada, para a tela
 * selecioná-lo e cotar o frete por ele. Só INSERE (não aceita `addressId`):
 * editar endereço é coisa de /conta. Repetir o mesmo endereço devolve o que já
 * existe em vez de duplicar.
 */
export async function saveCheckoutAddressAction(
  input: SaveAddressInput,
): Promise<SaveAddressResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, needsLogin: true, error: MSG_SESSAO };

  if (await freiaIp("checkout.address", 10))
    return { ok: false, error: MSG_FREIO };

  const i = (input ?? {}) as Partial<SaveAddressInput>;
  const cep = onlyDigits(cleanText(i.cep, 20));
  const number = cleanText(i.number, 20);
  const street = cleanText(i.street, 120);
  const city = cleanText(i.city, 80);
  const state = cleanText(i.state, 2).toUpperCase();
  const district = cleanText(i.district, 80) || null;
  const complement = cleanText(i.complement, 80) || null;

  if (cep.length !== 8)
    return { ok: false, field: "cep", error: "CEP inválido. Confira os números." };
  if (!number)
    return {
      ok: false,
      field: "number",
      error: "Informe o número (ou marque sem número).",
    };
  if (street.length < 2)
    return { ok: false, field: "street", error: "Informe a rua." };
  if (city.length < 2)
    return { ok: false, field: "city", error: "Informe a cidade." };
  if (!isValidUf(state))
    return { ok: false, field: "state", error: "Informe o estado (UF)." };

  const supabase = await createClient();

  // A FK de `addresses` aponta para `customers`, e quem acabou de entrar por
  // código pode não ter a linha ainda.
  await supabase
    .from("customers")
    .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

  const { data: existentes, error: readErr } = await supabase
    .from("addresses")
    .select(ADDRESS_COLS)
    .eq("customer_id", user.id);
  if (readErr)
    return { ok: false, error: "Não foi possível salvar o endereço. Tente de novo." };

  const lista = (existentes ?? []) as AddressRow[];
  const chave = chaveEndereco(cep, number, complement);
  const igual = lista.find(
    (a) => chaveEndereco(a.cep, a.number, a.complement) === chave,
  );
  if (igual) return { ok: true, address: toAddress(igual) };

  if (lista.length >= MAX_ENDERECOS)
    return {
      ok: false,
      error: `Você já tem ${MAX_ENDERECOS} endereços salvos. Escolha um deles ou apague algum em Minha conta.`,
    };

  // Linha montada campo a campo: nada do navegador entra sem passar acima.
  const { data: criado, error } = await supabase
    .from("addresses")
    .insert({
      customer_id: user.id,
      label: null,
      cep: maskCep(cep),
      street,
      number,
      complement,
      district,
      city,
      state,
      // O primeiro endereço vira o principal; os seguintes não roubam o posto.
      is_default: lista.length === 0,
    })
    .select(ADDRESS_COLS)
    .single();
  if (error || !criado)
    return { ok: false, error: "Não foi possível salvar o endereço. Tente de novo." };

  revalidatePath("/conta/enderecos");
  return { ok: true, address: toAddress(criado as AddressRow) };
}

export type SaveProfileInput = { fullName: string; cpf: string; phone: string };

export type SaveProfileResult =
  | { ok: true; profile: { fullName: string; cpf: string; phone: string } }
  | {
      ok: false;
      error: string;
      field?: "fullName" | "cpf" | "phone";
      needsLogin?: boolean;
    };

/**
 * Nome, CPF e telefone — o que o pagamento exige (`perfilCompleto`). Grava
 * formatado. Sem `auth.updateUser` (o nome de exibição é coisa de /conta) e
 * sem unicidade de CPF (casal com a mesma conta de cartão existe). O CPF não
 * vai para o `audit_log`.
 */
export async function saveCheckoutProfileAction(
  input: SaveProfileInput,
): Promise<SaveProfileResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, needsLogin: true, error: MSG_SESSAO };

  if (await freiaIp("checkout.profile", 10))
    return { ok: false, error: MSG_FREIO };

  const i = (input ?? {}) as Partial<SaveProfileInput>;
  const fullName = cleanText(i.fullName, 120);
  if (!isFullName(fullName))
    return { ok: false, field: "fullName", error: "Informe nome e sobrenome." };
  const cpf = formatCpf(cleanText(i.cpf, 20));
  if (!cpf)
    return { ok: false, field: "cpf", error: "CPF inválido. Confira os números." };
  const phone = formatPhone(cleanText(i.phone, 30));
  if (!phone)
    return {
      ok: false,
      field: "phone",
      error: "Telefone inválido. Use DDD e número.",
    };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .upsert({ id: user.id, full_name: fullName, cpf, phone });
  if (error)
    return { ok: false, error: "Não foi possível salvar seus dados. Tente de novo." };

  revalidatePath("/conta");
  return { ok: true, profile: { fullName, cpf, phone } };
}

/**
 * "Trocar" do passo 1: sai da conta e volta ao checkout anônimo (a sacola fica,
 * é localStorage). Destino fixo — nada vindo do navegador decide para onde vai.
 */
export async function signOutAtCheckoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
