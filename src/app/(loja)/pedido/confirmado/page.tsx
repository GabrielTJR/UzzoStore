import Link from "next/link";
import type { Metadata } from "next";
import {
  confirmPayment,
  urlInfinitepay,
  type ConfirmResult,
} from "@/lib/infinitepay";
import { getSessionUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ClearCart } from "./clear-cart";
import { OrderSummary, type ConfirmedOrder } from "./order-summary";
import { TrackPurchase } from "./track-purchase";

export const metadata: Metadata = {
  title: "Pedido confirmado",
  // Página pessoal de volta do pagamento: nada para indexar.
  robots: { index: false, follow: false },
};

/**
 * Volta do checkout da InfinitePay. Os parâmetros da URL não provam nada
 * (qualquer um digita), então confirmamos pelo servidor antes de dizer que
 * está pago. O webhook faz o mesmo — o primeiro que chegar processa.
 *
 * O resumo do pedido é lido com o client de COOKIE (RLS "cada um só vê o seu")
 * e filtrado por `customer_id` do usuário logado. Nunca com service_role a
 * partir do número da URL: o número é sequencial, e qualquer um que trocasse
 * `order_nsu` veria itens e endereço de outro cliente.
 */
export default async function PedidoConfirmadoPage({
  searchParams,
}: {
  searchParams: Promise<{
    order_nsu?: string;
    transaction_nsu?: string;
    slug?: string;
    receipt_url?: string;
    capture_method?: string;
  }>;
}) {
  const sp = await searchParams;
  const orderNsu = String(sp.order_nsu ?? "");
  const transactionNsu = String(sp.transaction_nsu ?? "");
  const slug = String(sp.slug ?? "");

  const result: ConfirmResult =
    orderNsu && transactionNsu && slug
      ? await confirmPayment({ orderNsu, transactionNsu, slug })
      : { paid: false, reason: "sem_dados" };

  // Número do pedido: o que o servidor confirmou ou, se o pagamento ainda não
  // apareceu, o da URL (só dígitos). Serve apenas de filtro numa leitura que o
  // RLS já restringe ao dono — não dá acesso a nada por si.
  const numero =
    result.orderNumber ??
    (/^\d{1,12}$/.test(orderNsu) ? Number(orderNsu) : null);

  // Sem número (ex.: /pedido/confirmado sem parâmetros) não há consulta.
  // `getSessionUser` é memoizado por requisição — o layout já o chamou.
  let order: ConfirmedOrder | null = null;
  if (numero != null) {
    const user = await getSessionUser();
    if (user) {
      const supabase = await createClient();
      const { data } = await supabase
        .from("orders")
        .select(
          `number, payment_status, shipping_method, shipping_address, subtotal,
           discount, coupon_code, shipping_cost, shipping_service, total,
           order_items ( product_name, variant_label, unit_price, qty )`,
        )
        .eq("number", numero)
        .eq("customer_id", user.id)
        .maybeSingle();
      order = (data as unknown as ConfirmedOrder | null) ?? null;
    }
  }

  // O banco é a verdade: se o webhook já marcou pago, a tela não precisa
  // esperar o `payment_check` do retorno para dizer isso.
  const paid = result.paid || order?.payment_status === "paid";
  // O link vem na URL de volta — qualquer um monta essa URL. Só vira botão
  // "Ver comprovante" se for da InfinitePay: com qualquer https, dava para
  // mandar a alguém um link do NOSSO domínio com um comprovante falso.
  const receipt = urlInfinitepay(sp.receipt_url) ? sp.receipt_url : null;

  // "Atualizar" recarrega a MESMA volta (mesmos parâmetros), o que refaz a
  // confirmação. Sem poller: um toque do cliente, nenhum custo parado.
  const atualizarHref = (() => {
    const q = new URLSearchParams();
    for (const k of [
      "order_nsu",
      "transaction_nsu",
      "slug",
      "receipt_url",
      "capture_method",
    ] as const) {
      const v = sp[k];
      if (typeof v === "string" && v) q.set(k, v);
    }
    const s = q.toString();
    return s ? `/pedido/confirmado?${s}` : "/pedido/confirmado";
  })();

  return (
    <section className="mx-auto max-w-lg px-page py-16">
      {paid && <ClearCart />}
      {/* Funil: a compra só é contada com pagamento confirmado E o pedido
          lido do próprio cliente — nunca a partir do que veio na URL. */}
      {paid && order && (
        <TrackPurchase
          number={order.number}
          total={Number(order.total)}
          shipping={Number(order.shipping_cost ?? 0)}
          coupon={order.coupon_code}
          items={order.order_items.map((i) => ({
            name: i.product_name,
            variant: i.variant_label,
            price: Number(i.unit_price),
            qty: i.qty,
          }))}
        />
      )}

      <h1 className="font-display text-3xl font-bold">
        {paid ? "Pagamento confirmado" : "Estamos confirmando seu pagamento"}
      </h1>

      <p className="mt-4 text-sm leading-relaxed text-muted">
        {paid ? (
          <>
            Recebemos seu pedido
            {numero != null ? ` nº ${numero}` : ""}. Você recebe um e-mail com
            os detalhes, e o andamento fica em Meus pedidos.
          </>
        ) : (
          <>
            Se você acabou de pagar, pode levar alguns instantes para o
            pagamento aparecer aqui. Você também pode acompanhar em Meus
            pedidos.
          </>
        )}
      </p>

      {!paid && (
        <a
          href={atualizarHref}
          className="mt-4 inline-block text-sm font-medium underline underline-offset-4"
        >
          Atualizar
        </a>
      )}

      {order && (
        <div className="mt-8">
          <OrderSummary order={order} />
        </div>
      )}

      <div className="mt-8 flex flex-col items-start gap-3">
        <Link
          href="/conta/pedidos"
          prefetch={false}
          className="inline-flex h-12 items-center justify-center rounded-xs bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Ver meus pedidos
        </Link>
        {receipt && (
          <a
            href={receipt}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted underline underline-offset-4 hover:text-foreground"
          >
            Ver comprovante
          </a>
        )}
        <Link
          href="/produtos"
          className="text-sm text-muted underline underline-offset-4 hover:text-foreground"
        >
          Continuar comprando
        </Link>
      </div>
    </section>
  );
}
