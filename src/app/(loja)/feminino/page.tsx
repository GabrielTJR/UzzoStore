import type { Metadata } from "next";
import Link from "next/link";
import { Catalog } from "@/components/catalog";
import { NewsletterForm } from "@/components/newsletter-form";
import { EMPTY_CATALOG } from "@/lib/catalog-url";
import { hasDepartmentProducts } from "@/lib/products";
import { whatsappLink } from "@/lib/store-info";

/** O "Em breve" da descrição sai sozinho quando a primeira peça entrar (a
 * mesma checagem da página, do cache do catálogo). */
export async function generateMetadata(): Promise<Metadata> {
  const temPecas = await hasDepartmentProducts("feminino");
  return {
    title: "Feminino",
    description: temPecas
      ? "Moda feminina da Uzzo Store, com a mesma tecnologia de tecido: peças que não amassam e secam rápido."
      : "Moda feminina da Uzzo Store, com a mesma tecnologia de tecido. Em breve.",
    alternates: { canonical: "/feminino" },
  };
}

/**
 * Seção Feminino. Enquanto não houver peça feminina ativa, mostra "em breve"
 * com captura de e-mail (a mesma lista da newsletter — action com freio por
 * IP). Quando a primeira peça for cadastrada, vira catálogo SOZINHA: a checagem
 * sai do cache do catálogo, que o admin derruba ao salvar um produto.
 */
export default async function FemininoPage() {
  if (await hasDepartmentProducts("feminino")) {
    return (
      <Catalog
        state={{ ...EMPTY_CATALOG, department: "feminino" }}
        homePath="/feminino"
      />
    );
  }

  return (
    <section className="px-page flex min-h-[70svh] flex-col justify-center py-16 lg:py-24">
      <h1 className="font-display max-w-[12ch] text-4xl font-extrabold leading-[1.02] lg:text-7xl">
        Feminino chega em breve.
      </h1>
      <p className="mt-5 max-w-[44ch] text-base leading-relaxed text-muted lg:text-lg">
        A Uzzo está preparando a coleção feminina, com os mesmos tecidos leves,
        respiráveis e que não amassam. Deixe seu e-mail e saiba primeiro quando
        ela entrar.
      </p>
      <div className="mt-8 max-w-md">
        <NewsletterForm />
      </div>
      <p className="mt-8 text-sm text-muted">
        Prefere conversar?{" "}
        <a
          href={whatsappLink(
            "Olá! Quero saber quando a coleção feminina chegar.",
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline underline-offset-4"
        >
          Fale com a loja no WhatsApp
        </a>{" "}
        ou{" "}
        <Link
          href="/masculino"
          className="text-foreground underline underline-offset-4"
        >
          veja o masculino
        </Link>
        .
      </p>
    </section>
  );
}
