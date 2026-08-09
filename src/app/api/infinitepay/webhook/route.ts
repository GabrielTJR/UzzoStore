import { NextResponse, type NextRequest } from "next/server";
import { confirmPayment } from "@/lib/infinitepay";

/**
 * Webhook da InfinitePay (pagamento aprovado).
 *
 * O corpo NÃO é autenticado (a API não tem segredo), então ele serve só como
 * AVISO: quem decide se o pedido foi pago é o `confirmPayment`, que pergunta
 * de volta à InfinitePay (`payment_check`) e confere o valor. Sem isso,
 * qualquer um marcaria pedidos como pagos mandando um POST aqui.
 *
 * Responder 200 = recebido; 400 faz a InfinitePay tentar de novo.
 */
export async function POST(request: NextRequest) {
  let body: {
    order_nsu?: string;
    transaction_nsu?: string;
    invoice_slug?: string;
    slug?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const orderNsu = String(body.order_nsu ?? "");
  const transactionNsu = String(body.transaction_nsu ?? "");
  const slug = String(body.invoice_slug ?? body.slug ?? "");
  if (!orderNsu || !transactionNsu || !slug)
    return NextResponse.json({ error: "missing fields" }, { status: 400 });

  const result = await confirmPayment({ orderNsu, transactionNsu, slug });

  // Não confirmado: 400 para a InfinitePay reenviar (pode ser corrida com o
  // processamento do pagamento do lado deles).
  if (!result.paid && result.reason !== "valor")
    return NextResponse.json({ ok: false }, { status: 400 });

  return NextResponse.json({ ok: true });
}
