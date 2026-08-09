import type { Metadata } from "next";
import Link from "next/link";
import {
  requireCustomer,
  getCustomerProfile,
  getCustomerAddresses,
} from "@/lib/customer";
import { CheckoutFlow } from "./checkout-flow";

export const metadata: Metadata = { title: "Finalizar compra" };

export default async function CheckoutPage() {
  await requireCustomer("/checkout");
  const [profile, addresses] = await Promise.all([
    getCustomerProfile(),
    getCustomerAddresses(),
  ]);
  if (!profile) return null;

  return (
    <section className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/sacola"
        className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        ← Voltar para a sacola
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">
        Finalizar compra
      </h1>

      <CheckoutFlow profile={profile} addresses={addresses} />
    </section>
  );
}
