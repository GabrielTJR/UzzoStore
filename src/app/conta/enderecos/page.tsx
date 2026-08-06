import Link from "next/link";
import type { Metadata } from "next";
import { requireCustomer, getCustomerAddresses } from "@/lib/customer";
import { AddressCard, NewAddressToggle } from "./address-forms";

export const metadata: Metadata = { title: "Meus endereços" };

const tab =
  "rounded-full border border-border px-4 py-1.5 text-sm text-muted transition-colors hover:border-foreground hover:text-foreground";

export default async function EnderecosPage() {
  await requireCustomer("/conta/enderecos");
  const addresses = await getCustomerAddresses();

  return (
    <section className="mx-auto max-w-3xl space-y-8 px-6 py-12">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Meus endereços
        </h1>
        <p className="mt-1 text-sm text-muted">
          Guarde onde você recebe as entregas para agilizar seus pedidos.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        <Link href="/conta" className={tab}>
          Dados
        </Link>
        <span className="rounded-full border border-foreground bg-foreground px-4 py-1.5 text-sm font-medium text-background">
          Endereços
        </span>
        <Link href="/conta/pedidos" className={tab}>
          Pedidos
        </Link>
      </nav>

      <div className="space-y-4">
        {addresses.map((a) => (
          <AddressCard key={a.id} address={a} />
        ))}
        {addresses.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted">
            Você ainda não cadastrou nenhum endereço.
          </p>
        )}
        <NewAddressToggle />
      </div>
    </section>
  );
}
