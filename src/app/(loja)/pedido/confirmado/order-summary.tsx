import { formatBRL } from "@/lib/format";
import { displayProductName } from "@/lib/product-name";
import { fretePedido } from "@/lib/shipping-config";

/**
 * Resumo do pedido na volta do pagamento.
 *
 * Server Component puro (sem JS no navegador): recebe o pedido JÁ lido pela
 * página com o client de cookie (RLS + `customer_id`), nunca por id vindo da
 * URL com service_role.
 *
 * O ponto principal é a linha de FRETE: antes esta tela dizia sempre que o
 * frete era acertado à parte, inclusive para quem tinha acabado de pagar o
 * frete no site — o cliente lia que ia ser cobrado de novo. Agora ela sai de
 * `fretePedido`, e a frase do WhatsApp só aparece quando o frete de fato não
 * foi cobrado (`a_combinar`).
 */

export type ConfirmedOrderAddress = {
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};

export type ConfirmedOrder = {
  number: number;
  payment_status: string;
  shipping_method: string | null;
  shipping_address: ConfirmedOrderAddress | null;
  subtotal: number | string;
  discount: number | string | null;
  coupon_code: string | null;
  shipping_cost: number | string | null;
  shipping_service: string | null;
  total: number | string;
  order_items: {
    product_name: string;
    variant_label: string | null;
    unit_price: number | string;
    qty: number;
  }[];
};

/** Endereço da loja — o MESMO de todo o site (Rua 3650, CEP 88330-218). */
const ENDERECO_LOJA = "Rua 3650, nº 3573 — Sala 2, Balneário Camboriú/SC";

export function OrderSummary({ order }: { order: ConfirmedOrder }) {
  const frete = fretePedido(order);
  const pago = order.payment_status === "paid";
  const discount = Number(order.discount ?? 0);
  const addr = order.shipping_method === "delivery" ? order.shipping_address : null;

  // Uma linha só para o frete, sem nunca expor o nome cru do serviço.
  const linhaFrete: { rotulo: string; valor: string } =
    frete.tipo === "retirada"
      ? { rotulo: "Retirada na loja", valor: "grátis" }
      : frete.tipo === "cobrado"
        ? {
            rotulo: frete.transportadora
              ? `Frete (${frete.transportadora})`
              : "Frete",
            valor: formatBRL(frete.valor),
          }
        : frete.tipo === "gratis"
          ? { rotulo: "Frete", valor: "grátis" }
          : { rotulo: "Frete", valor: "a combinar pelo WhatsApp" };

  const proximoPasso =
    frete.tipo === "retirada"
      ? "Avisamos por e-mail quando estiver pronto para retirar."
      : frete.tipo === "a_combinar"
        ? "O frete deste pedido não foi cobrado no site. Vamos combinar a entrega pelo WhatsApp."
        : "Vamos separar e postar seu pedido. Você recebe o código de rastreio por e-mail.";

  return (
    <div className="space-y-4 text-left">
      <div className="rounded-sm border border-border p-5">
        <h2 className="font-display text-lg font-bold">
          Pedido nº {order.number}
        </h2>

        <ul className="mt-4 space-y-3 text-sm">
          {order.order_items.map((i, k) => (
            <li key={k} className="flex justify-between gap-4">
              <span>
                {i.qty}× {displayProductName(i.product_name)}
                {i.variant_label && (
                  <span className="block text-muted">{i.variant_label}</span>
                )}
              </span>
              <span className="shrink-0 tabular-nums">
                {formatBRL(Number(i.unit_price) * i.qty)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums">{formatBRL(Number(order.subtotal))}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">
                {order.coupon_code ? `Cupom ${order.coupon_code}` : "Desconto"}
              </dt>
              <dd className="tabular-nums">−{formatBRL(discount)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{linhaFrete.rotulo}</dt>
            <dd className="text-right tabular-nums">{linhaFrete.valor}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-2 font-bold">
            <dt>{pago ? "Total pago" : "Total"}</dt>
            <dd className="tabular-nums">{formatBRL(Number(order.total))}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-sm border border-border p-5 text-sm">
        <h2 className="font-display text-base font-bold">
          {frete.tipo === "retirada" ? "Retirada" : "Entrega"}
        </h2>
        {frete.tipo === "retirada" ? (
          <p className="mt-2 text-muted">{ENDERECO_LOJA}</p>
        ) : (
          addr && (
            <p className="mt-2 text-muted">
              <span className="block">
                {addr.street}
                {addr.number ? `, ${addr.number}` : ""}
                {addr.complement ? ` — ${addr.complement}` : ""}
              </span>
              <span className="block">
                {addr.district ? `${addr.district}, ` : ""}
                {addr.city}
                {addr.state ? `/${addr.state}` : ""}
              </span>
              {addr.cep && <span className="block">CEP {addr.cep}</span>}
            </p>
          )
        )}
        <p className="mt-3">{proximoPasso}</p>
      </div>
    </div>
  );
}
