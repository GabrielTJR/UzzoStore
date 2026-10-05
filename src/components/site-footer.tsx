import Link from "next/link";
import { Logo } from "@/components/logo";
import { NewsletterForm } from "@/components/newsletter-form";
import {
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  MAPS_URL,
  STORE_ADDRESS_LINE,
  STORE_CITY_LINE,
  WHATSAPP_NUMBER_DISPLAY,
  WHATSAPP_URL,
} from "@/lib/store-info";

const titulo = "mb-3 text-sm font-semibold text-white";
const link = "transition-colors hover:text-white";

/**
 * Rodapé da loja — faixa preta de largura inteira, sempre preta nos dois temas
 * (fecha a página com o mesmo preto da faixa de avisos do topo).
 *
 * No celular os blocos ficam em 2 colunas: empilhados um sob o outro o rodapé
 * passava de uma tela inteira.
 */
export function SiteFooter() {
  return (
    <footer className="bg-black text-white">
      {/* Newsletter: bloco próprio, não mais uma coluna espremida. */}
      <div className="px-page grid gap-6 border-b border-white/15 py-10 lg:grid-cols-2 lg:items-center lg:py-14">
        <div>
          <h2 className="font-display text-2xl font-bold lg:text-3xl">
            Novidades antes de todo mundo.
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Lançamentos e ofertas no seu e-mail. Sem spam.
          </p>
        </div>
        <div className="lg:max-w-md lg:justify-self-end">
          <NewsletterForm inverse />
        </div>
      </div>

      <div className="px-page grid grid-cols-2 gap-x-6 gap-y-9 py-10 text-sm text-white/60 lg:grid-cols-[1.4fr_repeat(4,1fr)] lg:py-14">
        <div className="col-span-2 lg:col-span-1">
          <Logo height={30} className="h-7 lg:h-[34px]" />
          <p className="mt-4 hidden max-w-xs lg:block">
            Tecnologia que veste bem. Loja em Balneário Camboriú, com envio
            para todo o Brasil.
          </p>
        </div>

        <nav aria-label="Loja" className="space-y-2.5">
          <h3 className={titulo}>Loja</h3>
          <p>
            <Link href="/masculino" className={link}>
              Masculino
            </Link>
          </p>
          <p>
            <Link href="/feminino" className={link}>
              Feminino
            </Link>
          </p>
          <p>
            <Link href="/ofertas" className={link}>
              Ofertas
            </Link>
          </p>
          <p>
            <Link href="/produtos" className={link}>
              Todos os produtos
            </Link>
          </p>
        </nav>

        <nav aria-label="Ajuda" className="space-y-2.5">
          <h3 className={titulo}>Ajuda</h3>
          <p>
            <Link href="/trocas" className={link}>
              Trocas e devoluções
            </Link>
          </p>
          <p>
            <Link href="/faq" className={link}>
              Perguntas frequentes
            </Link>
          </p>
          <p>
            <Link href="/conta/pedidos" className={link}>
              Meus pedidos
            </Link>
          </p>
          <p>
            <Link href="/sobre" className={link}>
              Sobre a loja
            </Link>
          </p>
          <p>
            <Link href="/privacidade" className={link}>
              Privacidade e cookies
            </Link>
          </p>
        </nav>

        <div className="space-y-2.5">
          <h3 className={titulo}>Atendimento</h3>
          {/* O WhatsApp é o canal de venda da loja: ganha peso de texto. */}
          <p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white underline-offset-4 hover:underline"
            >
              WhatsApp {WHATSAPP_NUMBER_DISPLAY}
            </a>
          </p>
          <p>Seg a sex, 10h às 19h</p>
          <p>Sábado, 10h às 14h</p>
          <p>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={link}
            >
              Instagram {INSTAGRAM_HANDLE}
            </a>
          </p>
        </div>

        <div className="space-y-2.5">
          <h3 className={titulo}>Visite a loja</h3>
          <p>{STORE_ADDRESS_LINE}</p>
          <p>{STORE_CITY_LINE}</p>
          <p>
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-white"
            >
              Ver no mapa
            </a>
          </p>
        </div>
      </div>

      <div className="px-page flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-t border-white/15 py-5 text-xs text-white/50">
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
