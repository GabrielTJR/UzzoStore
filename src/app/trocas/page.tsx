import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Trocas e devoluções",
  description:
    "Política de trocas e devoluções da Uzzo Store — como trocar tamanho, prazos e o direito de arrependimento.",
};

/**
 * Política de troca — em roupa, o medo nº 1 é "e se não servir?". Página
 * estática (zero consulta). ⚠️ Os PRAZOS de troca por tamanho são prática
 * padrão do varejo, mas a palavra final é do dono — ajuste se a regra da
 * loja for outra. O direito de arrependimento de 7 dias é lei (CDC art. 49).
 */
export default function TrocasPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">
        Trocas e devoluções
      </h1>
      <p className="mt-3 text-muted">
        Comprou e não serviu? A gente resolve — troca de tamanho é rotina, não
        problema.
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-medium">Troca por tamanho ou cor</h2>
          <p className="mt-2 text-muted">
            Você tem <strong className="text-foreground">30 dias</strong> a
            partir do recebimento para trocar por outro tamanho ou cor, desde
            que a peça esteja sem uso, sem lavagem e com a etiqueta. É só chamar
            no{" "}
            <a
              href="https://wa.me/5547991744865"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              WhatsApp (47) 99174-4865
            </a>{" "}
            com o número do pedido que combinamos tudo.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">
            Arrependimento (compra online)
          </h2>
          <p className="mt-2 text-muted">
            Comprou pelo site e mudou de ideia? Você pode desistir da compra em
            até <strong className="text-foreground">7 dias corridos</strong>{" "}
            após o recebimento, com devolução integral do valor pago — é o seu
            direito pelo Código de Defesa do Consumidor (art. 49).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">Defeito de fabricação</h2>
          <p className="mt-2 text-muted">
            Peça com defeito tem troca garantida em até{" "}
            <strong className="text-foreground">90 dias</strong> (CDC art. 26).
            Mande uma foto pelo WhatsApp que agilizamos a substituição.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">Como funciona na prática</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
            <li>Chame no WhatsApp com o número do pedido.</li>
            <li>
              Combinar o caminho: trazer na loja (Balneário Camboriú) ou postar
              de volta pelos Correios.
            </li>
            <li>
              Peça conferida, enviamos o novo tamanho ou fazemos o estorno.
            </li>
          </ol>
        </section>

        <p className="border-t border-border pt-6 text-muted">
          Dúvida sobre medida antes de comprar? Cada produto tem a{" "}
          <strong className="text-foreground">tabela de medidas</strong> na
          página — e o WhatsApp está sempre aberto.{" "}
          <Link href="/produtos" className="underline underline-offset-4">
            Ver produtos
          </Link>
        </p>
      </div>
    </article>
  );
}
