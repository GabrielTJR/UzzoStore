import Link from "next/link";
import type { ReactNode } from "react";
import { formatBRL } from "@/lib/format";
import { displayProductName } from "@/lib/product-name";
import { fretePedido, linkRastreio } from "@/lib/shipping-config";
import {
  MAPS_URL,
  STORE_ADDRESS_LINE,
  STORE_CITY_LINE,
  whatsappLink,
} from "@/lib/store-info";
import { IconChat, IconExternal } from "@/components/icons";
import type { AccountOrder } from "../../order-data";
import { CancelOrderButton } from "../cancel-order-button";
import { PayOrderButton } from "../pay-order-button";
import { podePagarAgora } from "../pode-pagar";
import { OrderStatus, OrderThumb, OrderTimeline, dataPedido } from "../order-ui";

/**
 * Detalhe do pedido. No celular, a ordem é a das perguntas do cliente: onde
 * está (situação + linha do tempo), o que eu comprei, quanto paguei, para
 * onde vai. No desktop a linha do tempo e as peças ficam à esquerda e os
 * valores/entrega numa coluna à direita.
 *
 * "Pagar agora" e "Cancelar pedido" são os componentes que já existiam, com a
 * mesma lógica e as mesmas actions — só mudaram de lugar.
 */
export function OrderDetailView({ order: o }: { order: AccountOrder }) {
  const frete = fretePedido(o);
  const pago = o.payment_status === "paid";
  const cancelavel =
    o.payment_status === "pending" && o.fulfillment_status !== "canceled";

  // Uma linha só para o frete, sem expor o nome cru do serviço (mesma regra
  // da tela de pedido confirmado).
  const linhaFrete =
    frete.tipo === "retirada"
      ? { rotulo: "Retirada na loja", valor: "grátis" }
      : frete.tipo === "cobrado"
        ? {
            rotulo: frete.transportadora ? `Frete (${frete.transportadora})` : "Frete",
            valor: formatBRL(frete.valor),
          }
        : frete.tipo === "gratis"
          ? { rotulo: "Frete", valor: "grátis" }
          : { rotulo: "Frete", valor: "a combinar pelo WhatsApp" };

  const rastreio = o.tracking_code ? linkRastreio(o.tracking_code, o.shipping_service) : null;
  const addr = o.shipping_method === "delivery" ? o.shipping_address : null;

  return (
    <div>
      <Link
        href="/conta/pedidos"
        className="inline-flex min-h-11 items-center text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        Voltar para pedidos
      </Link>
      <header className="mt-1 mb-6 md:mb-8">
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          Pedido nº {o.number}
        </h1>
        <p className="mt-1 text-sm text-muted">Feito em {dataPedido(o.created_at, true)}</p>
        <OrderStatus order={o} className="mt-3 text-base" />
      </header>

      {/* Pagar vem antes de tudo: é a única coisa que o cliente PRECISA fazer. */}
      {podePagarAgora(o) && (
        <div className="mb-6 rounded-sm border border-accent/40 bg-accent/5 p-4 sm:p-5">
          <p className="mb-3 text-sm">
            As peças estão reservadas para você. Termine o pagamento para
            garantir o pedido.
          </p>
          <PayOrderButton orderId={o.id} expiresAt={o.expires_at} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <div className="space-y-6">
          <Bloco titulo="Andamento">
            <OrderTimeline order={o} />
          </Bloco>

          <Bloco titulo={`Peças (${o.items.reduce((n, i) => n + i.qty, 0)})`}>
            <ul className="divide-y divide-border">
              {o.items.map((it, k) => {
                const nome = displayProductName(it.product_name);
                return (
                  <li key={k} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                    <OrderThumb item={it} className="w-16" />
                    <div className="min-w-0 flex-1 text-sm">
                      {it.slug ? (
                        <Link
                          href={`/produtos/${it.slug}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {nome}
                        </Link>
                      ) : (
                        <p className="font-medium">{nome}</p>
                      )}
                      {it.variant_label && (
                        <p className="text-muted">{it.variant_label}</p>
                      )}
                      <p className="text-muted">
                        {it.qty} × {formatBRL(it.unit_price)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-medium tabular-nums">
                      {formatBRL(it.unit_price * it.qty)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Bloco>
        </div>

        <div className="space-y-6">
          <Bloco titulo="Valores">
            <dl className="space-y-1.5 text-sm">
              <Linha rotulo="Subtotal" valor={formatBRL(o.subtotal)} />
              {o.discount > 0 && (
                <Linha
                  rotulo={o.coupon_code ? `Cupom ${o.coupon_code}` : "Desconto"}
                  valor={`−${formatBRL(o.discount)}`}
                />
              )}
              <Linha rotulo={linhaFrete.rotulo} valor={linhaFrete.valor} />
              <div className="flex justify-between gap-4 border-t border-border pt-2.5 text-base font-semibold">
                <dt>{pago ? "Total pago" : "Total"}</dt>
                <dd className="tabular-nums">{formatBRL(o.total)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm text-muted">
              {o.channel === "online"
                ? "Pagamento pelo site (Pix ou cartão)."
                : "Pagamento combinado pelo WhatsApp."}
            </p>
          </Bloco>

          <Bloco titulo={o.shipping_method === "pickup" ? "Retirada" : "Entrega"}>
            {rastreio && o.tracking_code && (
              <div className="mb-4 rounded-xs bg-surface p-3 text-sm">
                <p className="text-muted">
                  Código de rastreio
                  {rastreio.transportadora ? ` — ${rastreio.transportadora}` : ""}
                </p>
                <p className="mt-0.5 select-all font-mono text-base font-semibold">
                  {o.tracking_code}
                </p>
                {rastreio.url ? (
                  <a
                    href={rastreio.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex min-h-11 items-center gap-2 font-medium underline underline-offset-4"
                  >
                    Acompanhar entrega
                    <IconExternal size={16} />
                  </a>
                ) : (
                  <p className="mt-1 text-muted">
                    Acompanhe no site da {rastreio.transportadora ?? "transportadora"}.
                  </p>
                )}
              </div>
            )}
            {o.shipping_method === "pickup" ? (
              <div className="text-sm">
                <p className="font-medium">Uzzo Store</p>
                <p className="text-muted">{STORE_ADDRESS_LINE}</p>
                <p className="text-muted">{STORE_CITY_LINE}</p>
                <p className="mt-1 text-muted">Seg a Sex 10h–19h, sábado 10h–14h.</p>
                <a
                  href={MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex min-h-11 items-center gap-2 font-medium underline underline-offset-4"
                >
                  Ver no mapa
                  <IconExternal size={16} />
                </a>
              </div>
            ) : addr ? (
              <div className="text-sm">
                {addr.label && <p className="font-medium">{addr.label}</p>}
                <p className={addr.label ? "text-muted" : ""}>
                  {[addr.street, addr.number].filter(Boolean).join(", ")}
                  {addr.complement ? ` — ${addr.complement}` : ""}
                </p>
                <p className="text-muted">
                  {[addr.district, [addr.city, addr.state].filter(Boolean).join("/")]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {addr.cep && <p className="text-muted">CEP {addr.cep}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted">Combinada pelo WhatsApp com a loja.</p>
            )}
          </Bloco>

          <a
            href={whatsappLink(`Olá! Tenho uma dúvida sobre o pedido nº ${o.number}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center gap-3 rounded-sm border border-border px-4 py-3 text-sm transition-colors hover:border-foreground"
          >
            <IconChat size={20} />
            <span>
              <span className="block font-medium">Dúvida sobre este pedido?</span>
              <span className="text-muted">Fale com a loja no WhatsApp</span>
            </span>
          </a>

          {cancelavel && (
            <div className="flex justify-center">
              <CancelOrderButton orderId={o.id} number={o.number} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-sm border border-border p-4 sm:p-5">
      <h2 className="mb-4 text-sm font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{rotulo}</dt>
      <dd className="text-right tabular-nums">{valor}</dd>
    </div>
  );
}
