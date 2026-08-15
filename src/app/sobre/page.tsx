import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sobre a Uzzo Store",
  description:
    "Loja de moda masculina em Balneário Camboriú/SC — tecnologia aplicada ao vestir: conforto, praticidade e elegância. Loja física + envio para todo o Brasil.",
};

/** A loja FÍSICA existe — isso é o maior selo de confiança que uma loja
 * online pequena pode ter. Página estática. */
export default function SobrePage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">
        Sobre a Uzzo Store
      </h1>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted">
        <p>
          A Uzzo é uma loja de moda masculina de{" "}
          <strong className="text-foreground">
            Balneário Camboriú, Santa Catarina
          </strong>
          . Nossa ideia é simples: tecnologia aplicada ao vestir — peças com
          tecido bom, caimento certo e praticidade para o dia a dia, sem
          complicação.
        </p>
        <p>
          Somos uma loja de verdade, com porta aberta:{" "}
          <strong className="text-foreground">
            Rua 3650, nº 3573 — Sala 2
          </strong>
          , de segunda a sexta das 10h às 19h e sábado das 10h às 14h. Pode vir
          provar, trocar, conhecer. E para quem está longe, enviamos para todo o
          Brasil.
        </p>
        <p>
          Atendimento é no{" "}
          <a
            href="https://wa.me/5547991744865"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            WhatsApp (47) 99174-4865
          </a>{" "}
          — quem responde é gente da loja, não robô. No Instagram, somos{" "}
          <a
            href="https://www.instagram.com/uzzostorebc/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            @uzzostorebc
          </a>
          .
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/produtos"
          className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background hover:opacity-90"
        >
          Ver produtos
        </Link>
        <a
          href="https://maps.app.goo.gl/bUxWeib7bJHjGp3K6"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-full border border-border px-6 text-sm font-medium hover:border-foreground"
        >
          Como chegar
        </a>
      </div>
    </article>
  );
}
