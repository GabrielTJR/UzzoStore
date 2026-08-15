import "server-only";
import { unstable_cache } from "next/cache";
import {
  pesoPadraoGramas,
  caixaParaPecas,
  FRETE_GRATIS_MIN,
} from "@/lib/shipping-config";

/**
 * Cotação de frete via Melhor Envio (fase 1: só cotação; etiqueta é comprada
 * no painel — automatizar depois que o fluxo estiver rodado).
 *
 * Sem chave secreta além do token (env `MELHORENVIO_TOKEN`; com
 * `MELHORENVIO_SANDBOX=1` aponta para o sandbox). SEM token a loja continua
 * funcionando: a cotação responde `unavailable` e a UI volta ao "combinar
 * pelo WhatsApp" — o frete nunca pode derrubar a venda.
 *
 * CUSTO: cada cotação é uma chamada externa. `unstable_cache` por
 * (CEP, composição da caixa) segura repetição — o mesmo CEP com a mesma
 * sacola vira UMA chamada por janela, e o rate da conta (250 req/min) fica
 * longe de estourar.
 */

const CEP_LOJA = "88330-218"; // Rua 3650, Balneário Camboriú — origem das postagens

export type ShippingOption = {
  /** id do serviço no Melhor Envio (1=PAC, 2=SEDEX, 3=.Package, 4=.Com…) */
  serviceId: number;
  name: string; // "SEDEX"
  company: string; // "Correios"
  price: number; // reais, já com o frete grátis aplicado quando for o caso
  days: number; // prazo em dias úteis
  free: boolean;
};

export type QuoteInput = {
  cepDestino: string;
  /** Peças da sacola já RELIDAS do banco (peso/categoria/preço do servidor). */
  itens: { weightGrams: number; price: number; qty: number }[];
};

function apiBase(): string {
  return process.env.MELHORENVIO_SANDBOX === "1"
    ? "https://sandbox.melhorenvio.com.br"
    : "https://melhorenvio.com.br";
}

export function shippingConfigured(): boolean {
  return !!process.env.MELHORENVIO_TOKEN?.trim();
}

/** Peso de uma peça: cadastro do produto ou padrão da categoria. */
export function pesoDaPeca(
  weightGrams: number | null,
  categoryName: string | null,
): number {
  return weightGrams && weightGrams > 0
    ? weightGrams
    : pesoPadraoGramas(categoryName);
}

type MEService = {
  id: number;
  name: string;
  price?: string;
  custom_price?: string;
  delivery_time?: number;
  delivery_range?: { min?: number; max?: number };
  company?: { name?: string };
  error?: string;
};

async function fetchQuote(
  cepDestino: string,
  pesoTotalKg: number,
  qtdPecas: number,
  valorSegurado: number,
): Promise<ShippingOption[]> {
  const token = process.env.MELHORENVIO_TOKEN?.trim();
  if (!token) throw new Error("sem token");
  const box = caixaParaPecas(qtdPecas);

  try {
    const res = await fetch(`${apiBase()}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        // A API recusa chamadas sem identificação da aplicação.
        "User-Agent": "UzzoStore (contato@uzzostore.com.br)",
      },
      body: JSON.stringify({
        from: { postal_code: CEP_LOJA },
        to: { postal_code: cepDestino },
        volumes: [
          {
            width: box.width,
            height: box.height,
            length: box.length,
            weight: Math.max(0.3, pesoTotalKg),
          },
        ],
        options: {
          insurance_value: Math.max(1, valorSegurado),
          receipt: false,
          own_hand: false,
        },
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[frete] cotação falhou", res.status, await res.text());
      throw new Error(`quote ${res.status}`);
    }
    const data = (await res.json()) as MEService[];
    const opts = data
      .filter((s) => !s.error && (s.custom_price ?? s.price))
      .map((s) => ({
        serviceId: s.id,
        name: s.name,
        company: s.company?.name ?? "",
        price: Number(s.custom_price ?? s.price),
        days: s.delivery_range?.max ?? s.delivery_time ?? 0,
        free: false,
      }))
      .filter((o) => Number.isFinite(o.price) && o.price > 0)
      .sort((a, b) => a.price - b.price)
      .slice(0, 3); // as 3 melhores bastam; lista longa só confunde
    if (!opts.length) throw new Error("quote vazia");
    return opts;
  } catch (err) {
    console.error("[frete] erro de rede", err);
    // Lançar (em vez de devolver null) impede o unstable_cache de GRAVAR a
    // falha: sem isso, 30 min de "sem frete" para todo mundo naquele CEP.
    throw err;
  }
}

/**
 * Cotação cacheada. A chave inclui CEP + peso + quantidade + faixa de valor
 * segurado — o suficiente para não vazar preço de uma cesta para outra.
 */
export async function quoteShipping(
  input: QuoteInput,
): Promise<{ options: ShippingOption[]; freeApplied: boolean } | null> {
  const cep = input.cepDestino.replace(/\D/g, "");
  if (cep.length !== 8) return null;

  const pesoTotalKg =
    input.itens.reduce((s, i) => s + i.weightGrams * i.qty, 0) / 1000;
  const qtd = input.itens.reduce((s, i) => s + i.qty, 0);
  const subtotal = input.itens.reduce((s, i) => s + i.price * i.qty, 0);
  // Segura o cache por faixas de R$ 50: seguro não precisa do centavo exato.
  const seguroFaixa = Math.ceil(subtotal / 50) * 50;

  const cached = unstable_cache(
    () => fetchQuote(cep, pesoTotalKg, qtd, seguroFaixa),
    ["frete", cep, String(pesoTotalKg), String(qtd), String(seguroFaixa)],
    { revalidate: 1800 }, // 30 min — preço de frete não muda a cada minuto
  );
  let options: ShippingOption[];
  try {
    options = await cached();
  } catch {
    return null; // falha momentânea: não cacheada, o próximo clique recota
  }

  // Frete grátis: aplica na opção MAIS BARATA quando o subtotal alcança o
  // mínimo. Servidor decide — o cliente não manda preço de frete nenhum.
  const freeApplied = FRETE_GRATIS_MIN != null && subtotal >= FRETE_GRATIS_MIN;
  if (freeApplied && options.length > 0) {
    options[0] = { ...options[0], price: 0, free: true };
  }
  return { options, freeApplied };
}
