import type { Metadata } from "next";
import { Catalog } from "@/components/catalog";
import { EMPTY_CATALOG } from "@/lib/catalog-url";

export const metadata: Metadata = {
  title: "Ofertas",
  description: "Peças da Uzzo Store com preço promocional.",
  alternates: { canonical: "/ofertas" },
};

/** Tudo que está em promoção, maior desconto primeiro — endereço limpo. */
export default function OfertasPage() {
  return (
    <Catalog
      state={{ ...EMPTY_CATALOG, promo: true, ordem: "promocao" }}
      title="Ofertas"
      homePath="/produtos"
    />
  );
}
