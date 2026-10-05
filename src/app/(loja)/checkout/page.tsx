import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import {
  getCustomerProfile,
  getCustomerAddresses,
  type CustomerAddress,
  type CustomerProfile,
} from "@/lib/customer";
import { shippingConfigured } from "@/lib/shipping";
import { CheckoutFlow } from "./checkout-flow";

// Página de sessão: nada de indexar (e o robots.ts já a proíbe).
export const metadata: Metadata = {
  title: "Finalizar compra",
  robots: { index: false, follow: false },
};

/**
 * Checkout em uma página. SEM `requireCustomer`: quem não está logado fica
 * aqui e se identifica no passo 1 (código por e-mail) — mandar para /entrar no
 * meio da compra era onde o cliente vindo do Instagram desistia.
 *
 * Anônimo não custa consulta nenhuma além do layout (a sessão já foi lida lá,
 * memoizada). Logado: perfil + endereços, sob RLS.
 *
 * O `<CheckoutFlow>` fica sempre na mesma posição e SEM `key`: depois de salvar
 * endereço ou dados, a action revalida e o servidor manda props novas — com
 * `key` mudando, o React remontaria o fluxo e o cliente perderia o passo.
 */
export default async function CheckoutPage() {
  const user = await getSessionUser();
  let profile: CustomerProfile | null = null;
  let addresses: CustomerAddress[] = [];
  if (user)
    [profile, addresses] = await Promise.all([
      getCustomerProfile(),
      getCustomerAddresses(),
    ]);

  return (
    <section className="mx-auto max-w-2xl px-page py-12">
      <Link
        href="/sacola"
        prefetch={false}
        className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        Voltar para a sacola
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold">
        Finalizar compra
      </h1>

      <CheckoutFlow
        profile={profile}
        addresses={addresses}
        shippingEnabled={shippingConfigured()}
      />
    </section>
  );
}
