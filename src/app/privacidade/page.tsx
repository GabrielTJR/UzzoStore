import type { Metadata } from "next";
import Link from "next/link";
import { CookieResetButton } from "@/components/cookie-consent";

export const metadata: Metadata = {
  title: "Privacidade e cookies",
  description:
    "Como a Uzzo Store trata seus dados: o que guardamos, com quem compartilhamos, quais cookies usamos e como exercer seus direitos.",
};

/**
 * Política de privacidade e cookies — página estática (zero consulta).
 *
 * ⚠️ Este texto descreve o que o sistema REALMENTE faz hoje: cada item foi
 * escrito a partir do código e do schema, não de um modelo genérico. Se o
 * tratamento mudar (novo serviço, novo dado coletado, novo cookie), o texto
 * tem de mudar junto — política que descreve outra coisa é pior que nenhuma.
 *
 * ⚠️ Não passou por advogado. É a descrição fiel da prática, e serve de base
 * para uma revisão jurídica — não substitui.
 */

const EMAIL = "contato@uzzostore.com.br";

export default function PrivacidadePage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">
        Privacidade e cookies
      </h1>
      <p className="mt-3 text-muted">
        Em português claro: o que a gente guarda, por quê, com quem divide e como
        você manda apagar.
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-medium">Quem somos</h2>
          <p className="mt-2 text-muted">
            UZZO COMERCIO LTDA, CNPJ 67.134.725/0001-43, Rua 3650, nº 3573 —
            Sala 2, Centro, Balneário Camboriú/SC, CEP 88330-218. Para qualquer
            assunto deste texto, fale com{" "}
            <a
              href={`mailto:${EMAIL}`}
              className="text-foreground underline underline-offset-4"
            >
              {EMAIL}
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">O que guardamos</h2>
          <p className="mt-2 text-muted">
            Só o necessário para vender e entregar:
          </p>
          <ul className="mt-3 space-y-2 text-muted">
            <li>
              <strong className="text-foreground">Conta:</strong> e-mail, nome,
              telefone e CPF. O CPF é exigido para emitir a nota fiscal.
            </li>
            <li>
              <strong className="text-foreground">Entrega:</strong> os endereços
              que você cadastra — usados para calcular o frete e despachar.
            </li>
            <li>
              <strong className="text-foreground">Pedidos:</strong> o que você
              comprou, valores, frete e cupom.
            </li>
            <li>
              <strong className="text-foreground">E-mail avulso:</strong> se você
              assinar a newsletter ou pedir aviso de reposição de um tamanho.
            </li>
            <li>
              <strong className="text-foreground">Endereço de IP:</strong>{" "}
              registrado nas ações do site para frear abuso — impedir que alguém
              dispare mil pedidos ou mil cotações de frete em sequência.
            </li>
          </ul>
          <p className="mt-3 text-muted">
            <strong className="text-foreground">
              Dados do seu cartão nunca passam por aqui.
            </strong>{" "}
            O pagamento acontece em página da InfinitePay; nós recebemos apenas a
            confirmação de que foi pago.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">Com quem compartilhamos</h2>
          <p className="mt-2 text-muted">
            Com quem é preciso para a compra funcionar, e mais ninguém. Não
            vendemos nem alugamos seus dados.
          </p>
          <ul className="mt-3 space-y-2 text-muted">
            <li>
              <strong className="text-foreground">InfinitePay</strong> —
              pagamento. Recebe nome, e-mail, telefone e endereço para montar a
              cobrança.
            </li>
            <li>
              <strong className="text-foreground">Melhor Envio</strong> — cálculo
              de frete. Recebe o CEP e as medidas da encomenda, não o seu nome.
            </li>
            <li>
              <strong className="text-foreground">Resend</strong> — envio dos
              e-mails de pedido.
            </li>
            <li>
              <strong className="text-foreground">Supabase</strong> e{" "}
              <strong className="text-foreground">Vercel</strong> — banco de
              dados e hospedagem do site, ambos em servidores no Brasil.
            </li>
            <li>
              <strong className="text-foreground">Google Analytics</strong> —
              medição de uso, <em>somente se você aceitar</em> (veja abaixo).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium">Cookies</h2>
          <p className="mt-2 text-muted">
            Cookie é um arquivinho que o site guarda no seu navegador. Aqui eles
            se dividem em dois grupos:
          </p>
          <ul className="mt-3 space-y-2 text-muted">
            <li>
              <strong className="text-foreground">Necessários</strong> — mantêm
              você logado e guardam a sua sacola. Sem eles o site não funciona,
              então não há o que escolher. A sacola, aliás, fica só no seu
              aparelho e não é enviada a lugar nenhum enquanto você não fecha o
              pedido.
            </li>
            <li>
              <strong className="text-foreground">De medição</strong> — o Google
              Analytics, que nos mostra quantas pessoas visitam e quais peças
              elas olham. <strong className="text-foreground">
                Só entram se você clicar em &ldquo;Aceitar&rdquo;
              </strong>
              : enquanto isso, nenhum script do Google é carregado na página.
            </li>
          </ul>
          <p className="mt-3 text-muted">
            Mudou de ideia, para um lado ou para o outro? Pode trocar quando
            quiser:
          </p>
          <div className="mt-4">
            <CookieResetButton />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-medium">Por quanto tempo</h2>
          <p className="mt-2 text-muted">
            Dados de pedido ficam pelo prazo em que a lei fiscal e o Código de
            Defesa do Consumidor exigem que a loja possa comprovar a venda. Conta
            sem pedido nenhum e inscrição de newsletter saem quando você pedir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">Seus direitos</h2>
          <p className="mt-2 text-muted">
            A LGPD (Lei 13.709/2018) garante que você peça, a qualquer momento:
            confirmação de que tratamos seus dados, acesso a eles, correção do
            que estiver errado, cópia para levar a outro lugar, exclusão do que
            não formos obrigados a guardar, e a revogação de qualquer
            consentimento que tenha dado.
          </p>
          <p className="mt-2 text-muted">
            Escreva para{" "}
            <a
              href={`mailto:${EMAIL}`}
              className="text-foreground underline underline-offset-4"
            >
              {EMAIL}
            </a>{" "}
            que a gente resolve. Boa parte você mesmo já faz em{" "}
            <Link
              href="/conta"
              className="text-foreground underline underline-offset-4"
            >
              Minha conta
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">Mudanças</h2>
          <p className="mt-2 text-muted">
            Se o jeito de tratar os dados mudar, este texto muda junto. Vale
            sempre a versão publicada aqui.
          </p>
        </section>
      </div>
    </article>
  );
}
