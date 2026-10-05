import "server-only";
import { logAudit } from "@/lib/audit";
import { fretePedido, linkRastreio } from "@/lib/shipping-config";

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
 * Para onde vai a RESPOSTA do cliente.
 *
 * A loja envia por `naoresponda@` (que não tem caixa) e lê em `contato@`. Sem
 * isto, quem clica em "responder" no aviso de pedido escreve para o vazio e
 * ninguém fica sabendo. Configurável por `EMAIL_REPLY_TO`.
 */
function replyTo(): string {
  return process.env.EMAIL_REPLY_TO?.trim() || "contato@uzzostore.com.br";
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
        reply_to: replyTo(),
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

/**
 * Escapa texto vindo do cliente antes de entrar no HTML do e-mail.
 *
 * Nome, telefone, endereço e nome de produto são digitados por terceiros e
 * chegam aqui só com `trim()`. Sem escapar, cabe um `<a href>` dentro do nome —
 * e o e-mail sai assinado com DKIM do domínio da loja, ou seja, com toda a
 * aparência de legítimo para quem abre no painel.
 */
function esc(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

/** Endereço de entrega como gravado em `orders.shipping_address` (jsonb). */
export type OrderEmailAddress = {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
};

/**
 * Endereço numa linha só, TEXTO PURO (quem usa dentro de HTML passa por
 * `esc()`): "Rua X, 123 — apto 4, Centro, Itajaí/SC, CEP 88300-000".
 *
 * Inclui complemento, bairro e CEP porque é desta linha que a loja copia o
 * destino na hora de comprar a etiqueta — sem o complemento a encomenda volta.
 */
export function linhaEndereco(a: OrderEmailAddress | null | undefined): string | null {
  if (!a) return null;
  const t = (v: string | null | undefined) => String(v ?? "").trim();
  const rua = [t(a.street), t(a.number)].filter(Boolean).join(", ");
  const cidade = [t(a.city), t(a.state)].filter(Boolean).join("/");
  const partes = [
    rua + (t(a.complement) ? ` — ${t(a.complement)}` : ""),
    t(a.district),
    cidade,
    t(a.cep) ? `CEP ${t(a.cep)}` : "",
  ].filter(Boolean);
  return partes.length ? partes.join(", ") : null;
}

/**
 * Linha de frete para o e-mail da LOJA, com o nome CRU do serviço
 * (".Package (Jadlog)"): é por ele que se acha o serviço no painel do Melhor
 * Envio na hora de comprar a etiqueta. Ao cliente vai só a transportadora.
 * Texto puro — `sendNewOrderAdminEmail` escapa.
 */
export function linhaFreteLoja(o: {
  shipping_method: string | null;
  shipping_cost: number | string | null;
  shipping_service: string | null;
}): string | null {
  const f = fretePedido(o);
  if (f.tipo === "retirada") return null;
  if (f.tipo === "a_combinar")
    return "Frete: NÃO cobrado no site — combinar com o cliente pelo WhatsApp";
  const servico = (o.shipping_service ?? "").trim();
  return f.tipo === "cobrado"
    ? `Frete: ${servico} — ${brl(f.valor)}, já cobrado no site`
    : `Frete: ${servico} — grátis para o cliente (a etiqueta é por conta da loja)`;
}

const P_ITENS =
  "font-size:14px;line-height:1.6;color:#444;padding-left:18px;margin:0 0 16px";
const TD_ROTULO = "padding:2px 0;color:#444";
const TD_VALOR = "padding:2px 0;text-align:right;white-space:nowrap";

/** Confirmação de pagamento aprovado. */
export async function sendOrderPaidEmail(params: {
  to: string;
  customerName: string | null;
  orderNumber: number;
  items: OrderEmailItem[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  shippingMethod: "pickup" | "delivery" | null;
  shippingCost: number;
  shippingService: string | null;
  address: OrderEmailAddress | null;
  total: number;
}): Promise<boolean> {
  const lines = params.items
    .map(
      (i) =>
        `<li style="margin-bottom:4px">${i.qty}× ${esc(i.productName)}${
          i.variantLabel ? ` — ${esc(i.variantLabel)}` : ""
        }: ${brl(i.unitPrice * i.qty)}</li>`,
    )
    .join("");

  // O frete sai do que o SERVIDOR gravou no pedido, não de um "pickup ou não":
  // antes todo pedido com entrega mandava acertar o frete pelo WhatsApp,
  // inclusive o de quem tinha acabado de pagar o frete no site.
  const frete = fretePedido({
    shipping_method: params.shippingMethod,
    shipping_cost: params.shippingCost,
    shipping_service: params.shippingService,
  });

  const linha = (rotulo: string, valor: string, forte = false) =>
    `<tr><td style="${TD_ROTULO}">${forte ? `<strong>${rotulo}</strong>` : rotulo}</td><td style="${TD_VALOR}">${
      forte ? `<strong>${valor}</strong>` : valor
    }</td></tr>`;

  const totais = [
    linha("Subtotal", brl(params.subtotal)),
    params.discount > 0
      ? linha(
          params.couponCode ? `Cupom ${esc(params.couponCode)}` : "Desconto",
          `−${brl(params.discount)}`,
        )
      : "",
    frete.tipo === "cobrado"
      ? linha(
          frete.transportadora
            ? `Frete (${esc(frete.transportadora)})`
            : "Frete",
          brl(frete.valor),
        )
      : frete.tipo === "gratis"
        ? linha("Frete", "grátis")
        : frete.tipo === "a_combinar"
          ? linha("Frete", "a combinar")
          : "",
    linha("Total pago", brl(params.total), true),
  ].join("");

  const endereco = linhaEndereco(params.address);
  const proximoPasso =
    frete.tipo === "retirada"
      ? "Assim que estiver separado avisamos para você retirar na loja (Rua 3650, nº 3573 — Sala 2, Balneário Camboriú/SC)."
      : frete.tipo === "a_combinar"
        ? "O frete deste pedido não foi cobrado no site: vamos combinar a entrega com você pelo WhatsApp."
        : `Vamos preparar o envio${
            endereco ? ` para ${esc(endereco)}` : ""
          }. Quando o pedido sair, você recebe outro e-mail com o código de rastreio.`;

  return send({
    to: params.to,
    kind: "pedido_pago",
    subject: `Pedido nº ${params.orderNumber} confirmado — Uzzo Store`,
    html: layout(
      "Pagamento confirmado 🎉",
      `<p style="font-size:15px;line-height:1.6;margin:0 0 16px">
        ${params.customerName ? `Olá, ${esc(params.customerName.split(" ")[0])}! ` : ""}
        Recebemos o pagamento do seu pedido <strong>nº ${params.orderNumber}</strong>.
      </p>
      <ul style="${P_ITENS}">${lines}</ul>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 16px;border-top:1px solid #eee;padding-top:8px">${totais}</table>
      <p style="font-size:14px;line-height:1.6;color:#444;margin:0">${proximoPasso}</p>`,
    ),
  });
}

/** Para quem avisar quando entra pedido (usa a mesma lista do acesso admin). */
function adminRecipients(): string[] {
  const raw =
    process.env.ADMIN_ORDER_EMAIL?.trim() || process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/** Avisa a LOJA que entrou pedido novo. */
export async function sendNewOrderAdminEmail(params: {
  orderNumber: number;
  total: number;
  items: OrderEmailItem[];
  customerName: string | null;
  customerPhone: string | null;
  channel: "online" | "whatsapp";
  shipping: "pickup" | "delivery" | null;
  addressLine?: string | null;
  /** Frete com o nome CRU do serviço (ver `linhaFreteLoja`). Texto puro. */
  shippingLine?: string | null;
}): Promise<boolean> {
  const to = adminRecipients();
  if (to.length === 0) return false;

  const lines = params.items
    .map(
      (i) =>
        `<li style="margin-bottom:4px">${i.qty}× ${esc(i.productName)}${
          i.variantLabel ? ` — ${esc(i.variantLabel)}` : ""
        } · ${brl(i.unitPrice * i.qty)}</li>`,
    )
    .join("");

  const entrega =
    params.shipping === "pickup"
      ? "🏬 Retirada na loja"
      : params.shipping === "delivery"
        ? `🚚 Entrega — ${esc(params.addressLine ?? "endereço no painel")}`
        : "combinar pelo WhatsApp";

  const html = layout(
    params.channel === "online"
      ? "Pedido pago no site 💰"
      : "Pedido pelo WhatsApp",
    `<p style="font-size:15px;line-height:1.6;margin:0 0 12px">
      <strong>Pedido nº ${params.orderNumber}</strong> —
      ${params.channel === "online" ? "pagamento já confirmado." : "aguardando confirmação no WhatsApp."}
    </p>
    <p style="font-size:14px;line-height:1.6;color:#444;margin:0 0 12px">
      Cliente: ${esc(params.customerName ?? "visitante sem conta")}${
        params.customerPhone ? ` · ${esc(params.customerPhone)}` : ""
      }<br>${entrega}${params.shippingLine ? `<br>${esc(params.shippingLine)}` : ""}
    </p>
    <ul style="font-size:14px;line-height:1.6;color:#444;padding-left:18px;margin:0 0 12px">${lines}</ul>
    <p style="font-size:15px;margin:0 0 16px"><strong>Total: ${brl(params.total)}</strong></p>
    <p style="font-size:14px;margin:0">
      <a href="https://uzzostore.com.br/admin/pedidos" style="color:#111">Abrir os pedidos no painel →</a>
    </p>`,
  );

  // Um envio por destinatário: assim um endereço inválido não derruba os outros.
  const results = await Promise.all(
    to.map((dest) =>
      send({
        to: dest,
        kind: "loja_pedido_novo",
        subject: `Novo pedido nº ${params.orderNumber} — ${brl(params.total)}`,
        html,
      }),
    ),
  );
  return results.some(Boolean);
}

/** Aviso de mudança de situação (pronto para retirada, enviado, concluído). */
export async function sendOrderStatusEmail(params: {
  to: string;
  customerName: string | null;
  orderNumber: number;
  status: "ready" | "shipped" | "done";
  /** Código de rastreio — vira link no e-mail de "enviado". */
  trackingCode?: string | null;
  /** "SEDEX (Correios)" — decide PARA ONDE o link de rastreio aponta. */
  shippingService?: string | null;
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
      body: (() => {
        if (!params.trackingCode)
          return "Seu pedido já está a caminho. Qualquer dúvida sobre a entrega, é só chamar no WhatsApp.";
        // O destino sai da transportadora do pedido, não do formato do código:
        // a maior parte dos envios para fora da região não é Correios.
        const { url, transportadora } = linkRastreio(
          params.trackingCode,
          params.shippingService,
        );
        const cod = `<strong>${esc(params.trackingCode)}</strong>`;
        const via = transportadora ? ` (${esc(transportadora)})` : "";
        return url
          ? `Seu pedido já está a caminho! Acompanhe pelo código ${cod}${via}: <a href="${url}">rastrear encomenda</a>. Qualquer dúvida, é só chamar no WhatsApp.`
          : `Seu pedido já está a caminho! Código de rastreio: ${cod} — acompanhe no site da ${
              transportadora ? esc(transportadora) : "transportadora"
            }. Qualquer dúvida, é só chamar no WhatsApp.`;
      })(),
    },
    done: {
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
        ${params.customerName ? `Olá, ${esc(params.customerName.split(" ")[0])}! ` : ""}
        Pedido <strong>nº ${params.orderNumber}</strong>.
      </p>
      <p style="font-size:15px;line-height:1.6;margin:0">${copy.body}</p>`,
    ),
  });
}

/** "Avise-me quando chegar": disparado quando o admin repõe o estoque. */
export async function sendBackInStockEmail(params: {
  to: string;
  productName: string;
  productSlug: string;
}): Promise<boolean> {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://uzzostore.com.br"}/produtos/${params.productSlug}`;
  return send({
    to: params.to,
    kind: "volta_estoque",
    subject: `${params.productName} voltou ao estoque!`,
    html: layout(
      "Chegou de novo 🎉",
      `<p style="font-size:15px;line-height:1.6;margin:0 0 16px">
        Você pediu para ser avisado: <strong>${esc(params.productName)}</strong>
        está disponível outra vez — e peça única costuma sair rápido.
      </p>
      <p style="margin:0 0 8px">
        <a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:12px 28px;border-radius:999px;font-size:14px;text-decoration:none">
          Ver o produto
        </a>
      </p>`,
    ),
  });
}
