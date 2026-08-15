import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session";
import type { User } from "@supabase/supabase-js";

/**
 * Conta do CLIENTE (comprador). Diferente do admin: aqui não há service_role —
 * tudo passa pelo client com cookie, e o RLS ("cada um só vê o seu", migração
 * 0001) é quem garante o isolamento entre clientes.
 */

export type CustomerProfile = {
  id: string;
  email: string | null;
  fullName: string | null;
  cpf: string | null;
  phone: string | null;
};

export type CustomerAddress = {
  id: string;
  label: string | null;
  cep: string;
  street: string;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string;
  state: string;
  isDefault: boolean;
};

/** Usuário logado (qualquer um) — memoizado por requisição em `session.ts`. */
export const getCurrentUser = getSessionUser;

/**
 * Perfil do cliente. A linha em `customers` é criada na primeira visita
 * (quem cadastra pelo e-mail pode confirmar a conta muito depois do signup,
 * então não dá para depender de criar no momento do cadastro).
 */
export const getCustomerProfile = cache(
  async (): Promise<CustomerProfile | null> => {
    const user = await getCurrentUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data } = await supabase
      .from("customers")
      .select("id, full_name, cpf, phone")
      .eq("id", user.id)
      .maybeSingle();

    if (!data) {
      const fullName =
        (user.user_metadata?.full_name as string | undefined) ?? null;
      await supabase
        .from("customers")
        .insert({ id: user.id, full_name: fullName });
      return {
        id: user.id,
        email: user.email ?? null,
        fullName,
        cpf: null,
        phone: null,
      };
    }

    return {
      id: user.id,
      email: user.email ?? null,
      fullName: data.full_name,
      cpf: data.cpf,
      phone: data.phone,
    };
  },
);

/** Guard das páginas de conta: manda para o login guardando o destino. */
export async function requireCustomer(next = "/conta"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return user;
}

/** Endereços do cliente logado (o principal primeiro). */
export async function getCustomerAddresses(): Promise<CustomerAddress[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("addresses")
    .select(
      "id, label, cep, street, number, complement, district, city, state, is_default",
    )
    .eq("customer_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at");
  if (error || !data) return [];
  return data.map((a) => ({
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
  }));
}
