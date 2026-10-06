import type { Metadata } from "next";
import { Catalog } from "@/components/catalog";
import { EMPTY_CATALOG } from "@/lib/catalog-url";

export const metadata: Metadata = {
  title: "Destaques",
  description: "As peças em destaque da Uzzo Store.",
  alternates: { canonical: "/destaques" },
};

/**
 * Os destaques da home (estrela no painel), em endereço limpo — é para onde
 * vai o "Ver tudo" da fileira Destaques. Antes ele levava a /masculino
 * inteiro. Filtros escolhidos aqui seguem para /produtos?destaques=1&…, como
 * toda faceta.
 */
export default function DestaquesPage() {
  return (
    <Catalog
      state={{ ...EMPTY_CATALOG, destaques: true }}
      title="Destaques"
      homePath="/produtos"
    />
  );
}
