import type { Metadata } from "next";
import { requireCustomer, getCustomerProfile } from "@/lib/customer";
import { DataView } from "./data-view";

export const metadata: Metadata = { title: "Meus dados" };

export default async function DadosPage() {
  await requireCustomer("/conta/dados");
  const profile = await getCustomerProfile();
  if (!profile) return null;
  return <DataView profile={profile} />;
}
