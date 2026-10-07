import Image from "next/image";
import Link from "next/link";
import type { ComponentType } from "react";
import { formatBRL } from "@/lib/format";
import { displayProductName } from "@/lib/product-name";
import {
  FULFILLMENT_STATUS,
  fulfillmentSteps,
  situacaoCliente,
} from "@/lib/admin-orders";
import { IconBag, IconChevronRight, IconShirt } from "@/components/icons";
import type { AccountOrder, AccountOrderItem } from "../order-data";
import { CancelOrderButton } from "./cancel-order-button";
import { PayOrderButton } from "./pay-order-button";
import { podePagarAgora } from "./pode-pagar";

/**
 * Peças de desenho dos pedidos do cliente (resumo, lista e detalhe). Server
 * Components: o único JS que vai ao navegador é o dos botões de pagar e
 * cancelar, que já existiam e são usados como estão.
 *
 * Regra que não pode regredir: o cliente vê UMA frase de situação
 * (`situacaoCliente`), nunca os dois eixos (pagamento × atendimento).
 */

/** Data curta no fuso da loja — o servidor da Vercel roda em UTC, e um pedido
 * das 22h sairia com a data do dia seguinte. */
export function dataPedido(iso: string, comHora = false): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(comHora ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "America/Sao_Paulo",
  });
}

type Tom = "acao" | "andamento" | "fim" | "parado";

/** O tom da frase: o cobalto (o SINAL da loja) só onde o cliente tem algo a
 * fazer — pagar. */
function tomDaSituacao(
  o: Pick<AccountOrder, "payment_status" | "fulfillment_status">,
): Tom {
  const s = situacaoCliente(o.payment_status, o.fulfillment_status);
  if (s === "Aguardando pagamento") return "acao";
  if (s === "Concluído") return "fim";
  if (o.fulfillment_status === "canceled" || o.payment_status !== "paid")
    return "parado";
  return "andamento";
}

export function OrderStatus({
  order,
  className = "",
}: {
  order: Pick<AccountOrder, "payment_status" | "fulfillment_status">;
  className?: string;
}) {
  const tom = tomDaSituacao(order);
  const ponto = {
    acao: "bg-accent",
    andamento: "bg-foreground",
    fim: "bg-muted",
    parado: "border border-muted",
  }[tom];
  return (
    <span
      className={`inline-flex items-center gap-2 text-sm ${
        tom === "acao"
          ? "font-semibold text-accent"
          : tom === "andamento"
            ? "font-semibold"
            : "text-muted"
      } ${className}`}
    >
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${ponto}`} />
      {situacaoCliente(order.payment_status, order.fulfillment_status)}
    </span>
  );
}

/** Foto 2:3 da peça (a mesma proporção do card da loja). */
export function OrderThumb({
  item,
  className = "w-14",
}: {
  item: Pick<AccountOrderItem, "image" | "product_name"> | undefined;
  className?: string;
}) {
  return (
    <div
      className={`relative aspect-[2/3] shrink-0 overflow-hidden rounded-xs bg-surface ${className}`}
    >
      {item?.image ? (
        <Image
          src={item.image}
          alt=""
          fill
          // Miniatura: as larguras pequenas do otimizador (64/128 px), nunca
          // a variante grande do card.
          sizes="64px"
          className="object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-muted/60">
          <IconShirt size={20} />
        </span>
      )}
    </div>
  );
}

function resumoDasPecas(items: AccountOrderItem[]): string {
  if (!items.length) return "Pedido sem itens";
  const pecas = items.reduce((n, i) => n + i.qty, 0);
  const primeiro = displayProductName(items[0].product_name);
  const outras = pecas - items[0].qty;
  if (outras <= 0)
    return items[0].qty > 1 ? `${items[0].qty}× ${primeiro}` : primeiro;
  return `${primeiro} + ${outras} ${outras === 1 ? "peça" : "peças"}`;
}

/** Ações de pedido em aberto — os botões que já existiam, só reposicionados. */
function AcoesPendentes({ order }: { order: AccountOrder }) {
  const cancelavel =
    order.payment_status === "pending" &&
    order.fulfillment_status !== "canceled";
  if (!cancelavel) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border px-4 py-3 sm:px-5">
      {podePagarAgora(order) ? (
        <PayOrderButton orderId={order.id} expiresAt={order.expires_at} />
      ) : (
        <span className="text-sm text-muted">
          {order.channel === "whatsapp"
            ? "Pagamento combinado pelo WhatsApp."
            : "Aguardando a confirmação do pagamento."}
        </span>
      )}
      <CancelOrderButton orderId={order.id} number={order.number} />
    </div>
  );
}

/** Cartão da lista: o cartão inteiro leva ao detalhe; as ações ficam num
 * rodapé à parte (botão dentro de link não é HTML válido). */
export function OrderCard({ order }: { order: AccountOrder }) {
  return (
    <article className="overflow-hidden rounded-sm border border-border">
      <Link
        href={`/conta/pedidos/${order.id}`}
        className="flex items-center gap-4 p-4 transition-colors hover:bg-surface/60 sm:p-5"
      >
        <OrderThumb item={order.items[0]} className="w-16" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold">Pedido nº {order.number}</p>
            <p className="shrink-0 font-semibold tabular-nums">
              {formatBRL(order.total)}
            </p>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted">
            {resumoDasPecas(order.items)}
          </p>
          <p className="text-sm text-muted">{dataPedido(order.created_at)}</p>
          <OrderStatus order={order} className="mt-2" />
        </div>
        <IconChevronRight size={18} className="shrink-0 text-muted" />
      </Link>
      <AcoesPendentes order={order} />
    </article>
  );
}

/* ---------- linha do tempo ---------- */

type Passo = {
  rotulo: string;
  estado: "feito" | "atual" | "futuro" | "interrompido";
  dica?: string;
};

const HORARIO_LOJA = "Seg a Sex 10h–19h, sábado 10h–14h.";

/**
 * A situação vista como caminho: pedido feito → pagamento → separando →
 * enviado (ou pronto para retirada) → concluído. Não temos a hora de cada
 * etapa gravada (só a do pedido), então só "Pedido feito" leva data — melhor
 * que inventar.
 */
/** Data em que o pedido chegou a uma etapa física (null se não há). */
function dataEtapa(o: AccountOrder, etapa: string): string | undefined {
  const iso = {
    preparing: o.preparing_at,
    ready: o.ready_at,
    shipped: o.shipped_at,
    done: o.done_at,
  }[etapa];
  return iso ? dataPedido(iso, true) : undefined;
}

export function passosDoPedido(o: AccountOrder): Passo[] {
  const feito: Passo = {
    rotulo: "Pedido feito",
    estado: "feito",
    dica: dataPedido(o.created_at, true),
  };

  // Pago e depois cancelado: o pagamento chegou sem peça sobrando. Quem pagou
  // não pode ler só "Cancelado" (mesma regra de `situacaoCliente`).
  if (o.payment_status === "paid" && o.fulfillment_status === "canceled")
    return [
      feito,
      {
        rotulo: "Pagamento confirmado",
        estado: "feito",
        dica: o.paid_at ? dataPedido(o.paid_at, true) : undefined,
      },
      {
        rotulo: "Em revisão pela loja",
        estado: "atual",
        dica: "Vamos falar com você para resolver — troca ou estorno.",
      },
    ];

  const parado =
    o.fulfillment_status === "canceled" ||
    ["canceled", "expired", "refunded"].includes(o.payment_status);
  if (parado)
    return [
      feito,
      {
        rotulo: situacaoCliente(o.payment_status, o.fulfillment_status),
        estado: "interrompido",
        dica:
          o.payment_status === "refunded"
            ? "O valor volta pelo mesmo meio do pagamento."
            : "As peças voltaram para a loja.",
      },
    ];

  const pago = o.payment_status === "paid";
  const etapas = fulfillmentSteps(o.shipping_method).slice(1); // sem "pending"
  // Até onde o pedido chegou: 0 = feito, 1 = pago, 2.. = etapas físicas.
  const alcancado = !pago
    ? 0
    : Math.max(
        1,
        etapas.indexOf(o.fulfillment_status as (typeof etapas)[number]) + 2,
      );

  const dicas: Record<string, string> = {
    preparing: "Estamos separando suas peças.",
    shipped: o.tracking_code
      ? "Acompanhe pelo código de rastreio abaixo."
      : "Seu pedido está a caminho.",
    ready: `Pode vir buscar. ${HORARIO_LOJA}`,
    done: "Obrigado pela compra!",
  };

  const passos: Passo[] = [
    feito,
    pago
      ? {
          rotulo: "Pagamento confirmado",
          estado: alcancado === 1 ? "atual" : "feito",
          // Etapa feita mostra QUANDO aconteceu; a atual, o que vem agora.
          dica:
            alcancado === 1
              ? `${o.paid_at ? `${dataPedido(o.paid_at, true)}. ` : ""}Já vamos separar suas peças.`
              : o.paid_at
                ? dataPedido(o.paid_at, true)
                : undefined,
        }
      : {
          rotulo: "Aguardando pagamento",
          estado: "atual",
          dica:
            o.channel === "whatsapp"
              ? "Combine o pagamento pelo WhatsApp."
              : "Assim que o pagamento entrar, separamos as peças.",
        },
    ...etapas.map((s, i): Passo => {
      const idx = i + 2;
      const estado =
        idx < alcancado ? "feito" : idx === alcancado ? "atual" : "futuro";
      return {
        rotulo:
          s === "shipped" && !o.shipping_method
            ? "Enviado ou entregue"
            : FULFILLMENT_STATUS[s],
        estado: s === "done" && idx === alcancado ? "feito" : estado,
        dica: (() => {
          const quando = dataEtapa(o, s);
          if (idx === alcancado)
            return quando ? `${quando}. ${dicas[s]}` : dicas[s];
          return idx < alcancado ? quando : undefined;
        })(),
      };
    }),
  ];
  return passos;
}

export function OrderTimeline({ order }: { order: AccountOrder }) {
  const passos = passosDoPedido(order);
  return (
    <ol className="space-y-0">
      {passos.map((p, i) => {
        const ultimo = i === passos.length - 1;
        const marca = {
          feito: "border-foreground bg-foreground",
          atual: "border-accent bg-accent ring-4 ring-accent/20",
          futuro: "border-border bg-background",
          interrompido: "border-muted bg-background",
        }[p.estado];
        return (
          <li
            key={p.rotulo}
            className="relative flex gap-4 pb-5 last:pb-0"
            aria-current={p.estado === "atual" ? "step" : undefined}
          >
            {/* Trilho: cheio até onde o pedido chegou. */}
            {!ultimo && (
              <span
                aria-hidden
                className={`absolute left-[5px] top-4 h-[calc(100%-0.75rem)] w-0.5 ${
                  passos[i + 1].estado === "feito" ||
                  passos[i + 1].estado === "atual"
                    ? "bg-foreground"
                    : "bg-border"
                }`}
              />
            )}
            <span
              aria-hidden
              className={`relative mt-1 flex h-3 w-3 shrink-0 items-center justify-center rounded-full border-2 ${marca}`}
            />
            <div className="min-w-0">
              <p
                className={`text-sm ${
                  p.estado === "atual"
                    ? "font-semibold"
                    : p.estado === "futuro"
                      ? "text-muted"
                      : p.estado === "interrompido"
                        ? "font-semibold text-muted"
                        : ""
                }`}
              >
                {p.rotulo}
                {p.estado === "feito" && (
                  <span className="sr-only"> (concluído)</span>
                )}
              </p>
              {p.dica && <p className="mt-0.5 text-sm text-muted">{p.dica}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- estado vazio ---------- */

/**
 * Seção vazia da conta (sem pedido, sem favorito). Contorno em vez de bloco
 * cinza (o cinza chapado parecia espaço quebrado), ícone da seção e DOIS
 * caminhos para a loja — quem chega aqui sem pedido é quem ainda vai comprar.
 */
export function EmptyState({
  title,
  text,
  Icon = IconBag,
  href = "/masculino",
  cta = "Ver a coleção",
  href2 = "/ofertas",
  cta2 = "Ofertas",
}: {
  title: string;
  text?: string;
  Icon?: ComponentType<{ size?: number; className?: string }>;
  href?: string;
  cta?: string;
  href2?: string | null;
  cta2?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-sm border border-border px-6 py-12 text-center md:py-16">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
        <Icon size={24} className="text-foreground" />
      </span>
      <p className="mt-4 font-display text-lg font-bold">{title}</p>
      {text && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{text}</p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link
          href={href}
          className="inline-flex h-11 items-center justify-center rounded-xs bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          {cta}
        </Link>
        {href2 && (
          <Link
            href={href2}
            className="inline-flex h-11 items-center justify-center rounded-xs border border-border px-6 text-sm font-medium transition-colors hover:border-foreground"
          >
            {cta2}
          </Link>
        )}
      </div>
    </div>
  );
}
