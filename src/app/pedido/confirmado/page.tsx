import Link from "next/link";
import type { Metadata } from "next";
import { confirmPayment } from "@/lib/infinitepay";
import { ClearCart } from "./clear-cart";

export const metadata: Metadata = { title: "Pedido confirmado" };

/**
 * Volta do checkout da InfinitePay. Os parâmetros da URL não provam nada
 * (qualquer um digita), então confirmamos pelo servidor antes de dizer que
 * está pago. O webhook faz o mesmo — o primeiro que chegar processa.
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

  const result =
    orderNsu && transactionNsu && slug
      ? await confirmPayment({ orderNsu, transactionNsu, slug })
      : { paid: false, reason: "sem_dados" as const };

  const paid = result.paid;
  const receipt =
    typeof sp.receipt_url === "string" && sp.receipt_url.startsWith("https://")
      ? sp.receipt_url
      : null;

  return (
    <section className="mx-auto max-w-lg px-6 py-20 text-center">
      {paid && <ClearCart />}

      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        {paid ? "Pagamento confirmado" : "Estamos confirmando seu pagamento"}
      </h1>

      <p className="mt-4 text-sm leading-relaxed text-muted">
        {paid ? (
          <>
            Recebemos seu pedido
            {result.orderNumber ? ` nº ${result.orderNumber}` : ""}. Vamos
            combinar a entrega pelo WhatsApp — o frete é acertado à parte.
          </>
        ) : (
          <>
            Se você acabou de pagar, pode levar alguns instantes para o
            pagamento aparecer aqui. Você também pode acompanhar em Meus
            pedidos.
          </>
        )}
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          href="/conta/pedidos"
          className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90"
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
