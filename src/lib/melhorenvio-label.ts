import "server-only";

/**
 * Etiqueta do Melhor Envio comprada pelo painel (fase 2 do frete).
 *
 * Fluxo em DOIS cliques, de propósito — etiqueta é dinheiro saindo da
 * carteira na hora:
 *  1. `prepararEtiqueta`: põe o envio no carrinho do Melhor Envio com a chave
 *     da NF-e e devolve o PREÇO REAL (pode diferir do cotado na compra).
 *     Nada é cobrado ainda.
 *  2. `comprarEtiqueta`: paga com o saldo da carteira, gera e devolve o link
 *     do PDF e o rastreio (quando a transportadora já informa).
 *
 * O token precisa das permissões cart-read, cart-write, shipment-checkout,
 * shipment-generate, shipment-print e orders-read (a cotação usa só
 * shipping-calculate). Sem elas a API responde 401/403 e a mensagem dela
 * aparece no painel.
 */

function apiBase(): string {
  return process.env.MELHORENVIO_SANDBOX === "1"
    ? "https://sandbox.melhorenvio.com.br"
    : "https://melhorenvio.com.br";
}

/** Remetente: os dados públicos da empresa (os mesmos do rodapé e do CEP de
 * origem da cotação — `CEP_LOJA` em shipping.ts). */
const REMETENTE = {
  name: "UZZO COMERCIO LTDA",
  phone: "47991744865",
  email: "contato@uzzostore.com.br",
  company_document: "67134725000143",
  address: "Rua 3650",
  number: "3573",
  complement: "Sala 2",
  district: "Centro",
  city: "Balneário Camboriú",
  state_abbr: "SC",
  country_id: "BR",
  postal_code: "88330218",
};

export type DadosEtiqueta = {
  serviceId: number;
  /** Chave de 44 dígitos da NF-e (emitida no Microvix). */
  nfeKey: string;
  numeroPedido: number;
  destinatario: {
    name: string;
    phone: string;
    email: string | null;
    cpf: string;
    street: string;
    number: string;
    complement: string | null;
    district: string;
    city: string;
    state: string;
    cep: string;
  };
  itens: { name: string; qty: number; unitPrice: number }[];
  volume: { width: number; height: number; length: number; weightKg: number };
  valorSegurado: number;
};

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

/** Agência de postagem por transportadora (Jadlog, LATAM e Azul exigem):
 * env `MELHORENVIO_AGENCIAS`, ex. `jadlog:123,latam:456`. */
function agenciaPara(servicoNome: string | null): number | undefined {
  const raw = process.env.MELHORENVIO_AGENCIAS ?? "";
  const nome = (servicoNome ?? "").toLowerCase();
  for (const par of raw.split(",")) {
    const [empresa, id] = par.split(":").map((s) => s.trim());
    if (empresa && id && nome.includes(empresa.toLowerCase()) && Number(id))
      return Number(id);
  }
  return undefined;
}

async function chamar<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<Resultado<T>> {
  const token = process.env.MELHORENVIO_TOKEN?.trim();
  if (!token) return { ok: false, error: "Falta o MELHORENVIO_TOKEN." };
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "UzzoStore (contato@uzzostore.com.br)",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const texto = await res.text();
    let json: unknown = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      /* resposta sem JSON */
    }
    if (!res.ok) {
      console.error("[etiqueta]", path, res.status, texto.slice(0, 500));
      return { ok: false, error: mensagemDeErro(res.status, json) };
    }
    return { ok: true, data: json as T };
  } catch (err) {
    console.error("[etiqueta] rede", path, err);
    return { ok: false, error: "Sem resposta do Melhor Envio. Tente de novo." };
  }
}

/** A API devolve erros em formatos variados ({message}, {errors:{campo:[…]}}). */
function mensagemDeErro(status: number, json: unknown): string {
  if (status === 401 || status === 403)
    return "O token do Melhor Envio não tem permissão para comprar etiquetas. Gere um token com as permissões de carrinho, compra, geração e impressão.";
  const j = (json ?? {}) as {
    message?: string;
    error?: string;
    errors?: Record<string, string[] | string>;
  };
  const detalhes = j.errors
    ? Object.values(j.errors)
        .flat()
        .filter((s) => typeof s === "string")
        .slice(0, 3)
        .join(" ")
    : "";
  const msg = [j.message ?? j.error, detalhes].filter(Boolean).join(" — ");
  return msg ? `Melhor Envio: ${msg}` : `Melhor Envio recusou (HTTP ${status}).`;
}

/** Passo 1: coloca no carrinho do Melhor Envio. Não cobra nada. */
export async function prepararEtiqueta(
  d: DadosEtiqueta,
  servicoNome: string | null,
): Promise<Resultado<{ id: string; price: number }>> {
  const agency = agenciaPara(servicoNome);
  const r = await chamar<{ id?: string; price?: number | string }>(
    "POST",
    "/api/v2/me/cart",
    {
      service: d.serviceId,
      ...(agency ? { agency } : {}),
      from: REMETENTE,
      to: {
        name: d.destinatario.name,
        phone: d.destinatario.phone.replace(/\D/g, ""),
        email: d.destinatario.email ?? undefined,
        document: d.destinatario.cpf.replace(/\D/g, ""),
        address: d.destinatario.street,
        number: d.destinatario.number || "S/N",
        complement: d.destinatario.complement ?? undefined,
        district: d.destinatario.district,
        city: d.destinatario.city,
        state_abbr: d.destinatario.state,
        country_id: "BR",
        postal_code: d.destinatario.cep.replace(/\D/g, ""),
      },
      products: d.itens.map((i) => ({
        name: i.name.slice(0, 100),
        quantity: i.qty,
        unitary_value: Number(i.unitPrice.toFixed(2)),
      })),
      volumes: [
        {
          width: d.volume.width,
          height: d.volume.height,
          length: d.volume.length,
          weight: Math.max(0.3, d.volume.weightKg),
        },
      ],
      options: {
        insurance_value: Math.max(1, Number(d.valorSegurado.toFixed(2))),
        receipt: false,
        own_hand: false,
        reverse: false,
        non_commercial: false,
        invoice: { key: d.nfeKey },
        platform: "Uzzo Store",
        tags: [{ tag: `Pedido ${d.numeroPedido}`, url: null }],
      },
    },
  );
  if (!r.ok) return r;
  const id = r.data?.id;
  const price = Number(r.data?.price);
  if (!id) return { ok: false, error: "O Melhor Envio não devolveu o envio." };
  return { ok: true, data: { id, price: Number.isFinite(price) ? price : 0 } };
}

/** Passo 2: paga (saldo da carteira), gera e devolve PDF + rastreio. */
export async function comprarEtiqueta(
  meId: string,
): Promise<Resultado<{ labelUrl: string; tracking: string | null }>> {
  const compra = await chamar("POST", "/api/v2/me/shipment/checkout", {
    orders: [meId],
  });
  if (!compra.ok) return compra;

  const gerar = await chamar("POST", "/api/v2/me/shipment/generate", {
    orders: [meId],
  });
  if (!gerar.ok)
    return {
      ok: false,
      error: `A etiqueta foi PAGA, mas não foi gerada ainda (${gerar.error}). Clique em "Gerar de novo" daqui a pouco.`,
    };

  return linkEtiqueta(meId);
}

/** Link do PDF + rastreio de uma etiqueta já paga (também serve para
 * re-tentar depois de uma geração que falhou). */
export async function linkEtiqueta(
  meId: string,
): Promise<Resultado<{ labelUrl: string; tracking: string | null }>> {
  // Gerar de novo uma etiqueta já gerada é inofensivo; garante o caso em que
  // o passo de geração falhou na primeira tentativa.
  await chamar("POST", "/api/v2/me/shipment/generate", { orders: [meId] });
  const print = await chamar<{ url?: string }>(
    "POST",
    "/api/v2/me/shipment/print",
    { mode: "public", orders: [meId] },
  );
  if (!print.ok) return print;
  const labelUrl = print.data?.url;
  if (!labelUrl || !/^https:\/\//.test(labelUrl))
    return { ok: false, error: "O Melhor Envio não devolveu o link da etiqueta." };
  return { ok: true, data: { labelUrl, tracking: await rastreioDe(meId) } };
}

/** Código de rastreio da transportadora (algumas só informam depois da
 * postagem — aí volta null e o botão "Buscar rastreio" tenta de novo). */
export async function rastreioDe(meId: string): Promise<string | null> {
  const r = await chamar<{ tracking?: string | null }>(
    "GET",
    `/api/v2/me/orders/${encodeURIComponent(meId)}`,
  );
  if (!r.ok) return null;
  const t = r.data?.tracking?.trim();
  return t ? t.toUpperCase().slice(0, 60) : null;
}

/** Tira do carrinho um envio preparado e não comprado (não cobra nada). */
export async function removerDoCarrinho(meId: string): Promise<void> {
  await chamar("DELETE", `/api/v2/me/cart/${encodeURIComponent(meId)}`);
}
