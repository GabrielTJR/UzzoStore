import type { Metadata } from "next";
import { Catalog } from "@/components/catalog";
import { EMPTY_CATALOG } from "@/lib/catalog-url";

export const metadata: Metadata = {
  title: "Masculino",
  description:
    "Moda masculina da Uzzo Store: polos, camisas, calças de alfaiataria e bermudas com tecidos que não amassam e secam rápido.",
  alternates: { canonical: "/masculino" },
};

/** Seção Masculino — endereço limpo. Os filtros levam a /produtos?… */
export default function MasculinoPage() {
  return (
    <Catalog
      state={{ ...EMPTY_CATALOG, department: "masculino" }}
      homePath="/masculino"
    />
  );
}
