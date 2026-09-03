import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Perguntas frequentes",
  description:
    "Dúvidas sobre pagamento, entrega, troca e tamanhos na Uzzo Store.",
};

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Quais são as formas de pagamento?",
    a: "Pix ou cartão de crédito, num ambiente de pagamento seguro (InfinitePay). Em até 3x sem juros; acima disso o parcelamento vai até 12x com juros, e o valor exato de cada parcela aparece na tela de pagamento antes de você confirmar. Também dá para fechar o pedido direto pelo WhatsApp.",
  },
  {
    q: "Vocês entregam na minha cidade?",
    a: "Sim — enviamos para todo o Brasil pelos Correios e transportadoras parceiras. O frete e o prazo aparecem na sacola ao digitar seu CEP. Em Balneário Camboriú, você também pode retirar na loja sem custo.",
  },
  {
    q: "Comprei e não serviu. E agora?",
    a: (
      <>
        Troca de tamanho em até 30 dias, sem drama. Veja como funciona em{" "}
        <Link href="/trocas" className="underline underline-offset-4">
          Trocas e devoluções
        </Link>
        .
      </>
    ),
  },
  {
    q: "Como escolho o tamanho certo?",
    a: 'Cada produto tem a tabela de medidas na própria página (botão "Tabela de medidas"). Na dúvida entre dois tamanhos, chame no WhatsApp com sua altura e peso que ajudamos a escolher.',
  },
  {
    q: "Como acompanho meu pedido?",
    a: (
      <>
        Você recebe e-mails a cada etapa e pode acompanhar tudo em{" "}
        <Link href="/conta/pedidos" className="underline underline-offset-4">
          Meus pedidos
        </Link>
        . Quando o pedido é postado, o código de rastreio aparece lá e vai no
        e-mail de envio.
      </>
    ),
  },
  {
    q: "O site é seguro?",
    a: "Sim. O pagamento acontece no ambiente da InfinitePay (a loja não vê nem guarda os dados do seu cartão) e o site inteiro roda com conexão criptografada (HTTPS). E somos uma loja física em Balneário Camboriú — pode visitar quando quiser.",
  },
  {
    q: "Item esgotado volta?",
    a: 'Muitas vezes sim. Na página do produto, selecione o tamanho esgotado e use o "Avise-me quando chegar" — você recebe um e-mail assim que repor.',
  },
];

export default function FaqPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">
        Perguntas frequentes
      </h1>

      <div className="mt-8 divide-y divide-border border-y border-border">
        {FAQS.map((f) => (
          <details key={f.q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
              {f.q}
              <span
                aria-hidden
                className="text-muted transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div className="mt-2 text-sm leading-relaxed text-muted">{f.a}</div>
          </details>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted">
        Não achou sua dúvida?{" "}
        <a
          href="https://wa.me/5547991744865"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline underline-offset-4"
        >
          Chama no WhatsApp
        </a>{" "}
        que a gente responde rapidinho.
      </p>
    </article>
  );
}
