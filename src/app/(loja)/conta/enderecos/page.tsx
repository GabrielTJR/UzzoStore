import type { Metadata } from "next";
import { requireCustomer, getCustomerAddresses } from "@/lib/customer";
import { AccountHeading } from "../account-shell";
import { AddressesManager } from "./address-forms";

export const metadata: Metadata = { title: "Meus endereços" };

export default async function EnderecosPage() {
  await requireCustomer("/conta/enderecos");
  const addresses = await getCustomerAddresses();

  return (
    <>
      <AccountHeading
        title="Endereços"
        description="O principal já vem marcado no checkout."
      />
      <AddressesManager addresses={addresses} />
    </>
  );
}
