import Link from "next/link";
import { Logo } from "@/components/logo";
import { NewsletterForm } from "@/components/newsletter-form";
import { FooterSections, type FooterSecao } from "@/components/footer-sections";
import {
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  MAPS_URL,
  STORE_ADDRESS_LINE,
  STORE_CITY_LINE,
  WHATSAPP_NUMBER_DISPLAY,
  WHATSAPP_URL,
} from "@/lib/store-info";

const link = "transition-colors hover:text-white";

/**
 * Rodapé da loja — faixa preta de largura inteira, sempre preta nos dois temas
 * (fecha a página com o mesmo preto da faixa de avisos do topo).
 *
 * Discreto de propósito (pedido do dono, 07/10/2026): newsletter numa linha,
 * sem título de vitrine. No CELULAR as quatro seções são cartões que abrem um
 * de cada vez (`FooterSections` — o escolhido vai para a esquerda e os outros
 * deslizam para a direita); no COMPUTADOR ficam as quatro colunas abertas,
 * porque lá sobra espaço e ninguém precisa tocar para achar um link.
 *
 * A identificação da empresa (razão social, CNPJ, endereço) fica SEMPRE à
 * vista, nos dois formatos — é exigência legal, não enfeite.
 */
export function SiteFooter() {
  const lista = "space-y-2.5 lg:space-y-2";
  const secoes: FooterSecao[] = [
    {
      id: "comprar",
      titulo: "Comprar",
      conteudo: (
        <ul className={lista}>
          <li>
            <Link href="/masculino" className={link}>
              Masculino
            </Link>
          </li>
          <li>
            <Link href="/feminino" className={link}>
              Feminino
            </Link>
          </li>
          <li>
            <Link href="/ofertas" className={link}>
              Ofertas
            </Link>
          </li>
          <li>
            <Link href="/produtos" className={link}>
              Todos os produtos
            </Link>
          </li>
        </ul>
      ),
    },
    {
      id: "ajuda",
      titulo: "Ajuda",
      conteudo: (
        <ul className={lista}>
          <li>
            <Link href="/trocas" className={link}>
              Trocas e devoluções
            </Link>
          </li>
          <li>
            <Link href="/faq" className={link}>
              Perguntas frequentes
            </Link>
          </li>
          <li>
            <Link href="/conta/pedidos" className={link}>
              Meus pedidos
            </Link>
          </li>
          <li>
            <Link href="/sobre" className={link}>
              Sobre a loja
            </Link>
          </li>
          <li>
            <Link href="/privacidade" className={link}>
              Privacidade e cookies
            </Link>
          </li>
        </ul>
      ),
    },
    {
      id: "contato",
      titulo: "Contato",
      conteudo: (
        <ul className={lista}>
          {/* O WhatsApp é o canal de venda da loja: ganha peso de texto. */}
          <li>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white underline-offset-4 hover:underline"
            >
              WhatsApp {WHATSAPP_NUMBER_DISPLAY}
            </a>
          </li>
          <li>Seg a sex, 10h às 19h</li>
          <li>Sábado, 10h às 14h</li>
          <li>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={link}
            >
              Instagram {INSTAGRAM_HANDLE}
            </a>
          </li>
        </ul>
      ),
    },
    {
      id: "endereco",
      titulo: "Endereço",
      conteudo: (
        <ul className={lista}>
          <li>{STORE_ADDRESS_LINE}</li>
          <li>{STORE_CITY_LINE}</li>
          <li>
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-white"
            >
              Ver no mapa
            </a>
          </li>
        </ul>
      ),
    },
  ];

  return (
    // `overflow-anchor: none` no rodapé TODO: ao abrir uma seção no celular
    // ele muda de altura, e a "âncora de rolagem" do Chrome escolhia a faixa
    // da empresa (logo abaixo dos cartões) como referência e rolava a página
    // junto — a tela pulava (o dono viu, 07/10/2026). Só nos cartões não basta.
    <footer className="bg-black text-white [overflow-anchor:none]">
      {/* Newsletter discreta: uma linha e o campo. */}
      <div className="px-page flex flex-col gap-3 border-b border-white/15 py-6 lg:flex-row lg:items-center lg:justify-between lg:py-5">
        <p className="text-sm font-semibold">
          Receba lançamentos e ofertas
          <span className="hidden font-normal text-white/50 lg:inline">
            {" "}
            — sem spam.
          </span>
        </p>
        <div className="lg:w-[26rem]">
          <NewsletterForm inverse compact />
        </div>
      </div>

      {/* Celular: cartões que abrem um de cada vez. */}
      <div className="px-page py-6 lg:hidden">
        <FooterSections secoes={secoes} />
      </div>

      {/* Computador: as quatro colunas abertas, discretas. */}
      <div className="px-page hidden grid-cols-[1.4fr_repeat(4,1fr)] gap-x-6 py-8 text-sm text-white/60 lg:grid">
        <div>
          <Logo height={26} className="h-[26px]" />
          <p className="mt-3 max-w-xs text-[0.8rem]">
            Tecnologia que veste bem. Loja em Balneário Camboriú, com envio para
            todo o Brasil.
          </p>
        </div>
        {secoes.map((s) => (
          <nav key={s.id} aria-label={s.titulo}>
            <h3 className="mb-2.5 text-[0.8rem] font-semibold text-white">
              {s.titulo}
            </h3>
            {s.conteudo}
          </nav>
        ))}
      </div>

      <div className="px-page flex flex-wrap items-end justify-between gap-x-8 gap-y-2 border-t border-white/15 py-4 text-[0.7rem] leading-relaxed text-white/45 lg:text-xs">
        {/* Identificação da empresa: o Decreto 7.962/2013 exige razão social,
            CNPJ e endereço físico em local de fácil visualização em qualquer
            site que venda. Não é enfeite de rodapé — não remova. */}
        <div className="space-y-0.5">
          <p>© 2026 Uzzo Store. UZZO COMERCIO LTDA, CNPJ 67.134.725/0001-43</p>
          {/* Rua 3650 e Av. Brasil são a mesma esquina e o cartão CNPJ traz a
              segunda, mas o site inteiro (retirada, e-mails, frete) usa a
              primeira — e o CEP 88330-218 é o dela. */}
          <p>
            Rua 3650, nº 3573 — Sala 2, Centro, Balneário Camboriú/SC, CEP
            88330-218
          </p>
        </div>
        {/* "3x sem juros ou até 12x": quem decide é a conta na InfinitePay
            (ver CLAUDE.md). Débito não entra: o Checkout Integrado só faz Pix
            e crédito. */}
        <p>Pix e cartão em até 12x (3x sem juros)</p>
      </div>
    </footer>
  );
}
