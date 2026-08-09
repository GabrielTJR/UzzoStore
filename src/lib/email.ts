import "server-only";
import { logAudit } from "@/lib/audit";

/**
 * E-mails transacionais (pedido pago, pedido enviado) pela API do Resend.
 *
 * O SMTP configurado no Supabase cobre só os e-mails de LOGIN (confirmação de
 * cadastro, recuperação de senha). Estes aqui saem do nosso servidor.
 *
 * Falha de e-mail nunca derruba a operação: se não der para enviar, a compra
 * continua valendo — só registramos no log.
 */

const API = "https://api.resend.com/emails";

function from(): string {
  return (
    process.env.EMAIL_FROM?.trim() || "Uzzo Store <contato@uzzostore.com.br>"
  );
}

/**
 * Envia e SEMPRE registra a tentativa no audit_log (/admin/logs).
 *
 * Sem isso, uma falha de envio só aparecia no log da Vercel — e a loja ficava
 * sem saber por que o cliente não recebeu (ex.: o Resend recusa destinatário
 * quando o domínio não está verificado, ou a chave está errada).
 */
async function send(params: {
  to: string;
  subject: string;
  html: string;
  kind: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    await logAudit(null, {
      action: "email.skipped",
      entityType: "email",
      entityLabel: params.to,
      metadata: { kind: params.kind, motivo: "RESEND_API_KEY ausente" },
    });
    return false;
  }

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from(),
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
      cache: "no-store",
    });
    const text = await res.text();

    if (!res.ok) {
      console.error("[email] falhou", res.status, text);
      await logAudit(null, {
        action: "email.failed",
        entityType: "email",
        entityLabel: params.to,
        metadata: {
          kind: params.kind,
          status: res.status,
          from: from(),
          resposta: text.slice(0, 500),
        },
      });
      return false;
    }

    await logAudit(null, {
      action: "email.sent",
      entityType: "email",
      entityLabel: params.to,
      metadata: { kind: params.kind, from: from() },
    });
    return true;
  } catch (err) {
    console.error("[email] erro", err);
    await logAudit(null, {
      action: "email.failed",
      entityType: "email",
      entityLabel: params.to,
      metadata: {
        kind: params.kind,
        erro: err instanceof Error ? err.message : String(err),
      },
    });
    return false;
  }
}

function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function layout(title: string, body: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111">
  <h1 style="font-size:22px;margin:0 0 16px">${title}</h1>
  ${body}
  <p style="font-size:12px;color:#888;margin:28px 0 0;border-top:1px solid #eee;padding-top:16px">
    Uzzo Store — Balneário Camboriú/SC · WhatsApp (47) 99174-4865
  </p>
</div>`;
}

export type OrderEmailItem = {
  productName: string;
  variantLabel: string | null;
  unitPrice: number;
  qty: number;
};

/** Confirmação de pagamento aprovado. */
export async function sendOrderPaidEmail(params: {
  to: string;
  customerName: string | null;
  orderNumber: number;
  total: number;
  items: OrderEmailItem[];
  pickup: boolean;
}): Promise<boolean> {
  const lines = params.items
    .map(
      (i) =>
        `<li style="margin-bottom:4px">${i.qty}× ${i.productName}${
          i.variantLabel ? ` — ${i.variantLabel}` : ""
        } · ${brl(i.unitPrice * i.qty)}</li>`,
    )
    .join("");

  return send({
    to: params.to,
    kind: "pedido_pago",
    subject: `Pedido nº ${params.orderNumber} confirmado — Uzzo Store`,
    html: layout(
      "Pagamento confirmado 🎉",
      `<p style="font-size:15px;line-height:1.6;margin:0 0 16px">
        ${params.customerName ? `Olá, ${params.customerName.split(" ")[0]}! ` : ""}
        Recebemos o pagamento do seu pedido <strong>nº ${params.orderNumber}</strong>.
      </p>
      <ul style="font-size:14px;line-height:1.6;color:#444;padding-left:18px;margin:0 0 16px">${lines}</ul>
      <p style="font-size:15px;margin:0 0 16px"><strong>Total: ${brl(params.total)}</strong></p>
      <p style="font-size:14px;line-height:1.6;color:#444;margin:0">
        ${
          params.pickup
            ? "Assim que estiver separado avisamos para você retirar na loja (Rua 3650, nº 3573 — Sala 2, Balneário Camboriú/SC)."
            : "Vamos combinar a entrega e o frete pelo WhatsApp."
        }
      </p>`,
    ),
  });
}

/** Aviso de mudança de situação (pronto para retirada, enviado, concluído). */
export async function sendOrderStatusEmail(params: {
  to: string;
  customerName: string | null;
  orderNumber: number;
  status: "ready" | "shipped" | "delivered";
}): Promise<boolean> {
  const copy = {
    ready: {
      subject: `Pedido nº ${params.orderNumber} pronto para retirada`,
      title: "Seu pedido está pronto 🛍️",
      body: "Pode vir buscar na loja: Rua 3650, nº 3573 — Sala 2, Balneário Camboriú/SC. Seg a Sex 10h–19h, Sábado 10h–14h.",
    },
    shipped: {
      subject: `Pedido nº ${params.orderNumber} enviado`,
      title: "Seu pedido saiu para entrega 🚚",
      body: "Seu pedido já está a caminho. Qualquer dúvida sobre a entrega, é só chamar no WhatsApp.",
    },
    delivered: {
      subject: `Pedido nº ${params.orderNumber} concluído`,
      title: "Pedido concluído ✅",
      body: "Esperamos que goste das peças! Se precisar de troca ou tiver qualquer dúvida, fale com a gente no WhatsApp.",
    },
  }[params.status];

  return send({
    to: params.to,
    kind: `pedido_${params.status}`,
    subject: copy.subject,
    html: layout(
      copy.title,
      `<p style="font-size:15px;line-height:1.6;margin:0 0 16px">
        ${params.customerName ? `Olá, ${params.customerName.split(" ")[0]}! ` : ""}
        Pedido <strong>nº ${params.orderNumber}</strong>.
      </p>
      <p style="font-size:15px;line-height:1.6;margin:0">${copy.body}</p>`,
    ),
  });
}
