import "server-only";
import { unstable_cache } from "next/cache";
import {
  pesoPadraoGramas,
  caixaParaPecas,
  FRETE_GRATIS_MIN,
  FRETE_CUSTO_POR_DIA_MAX,
  FRETE_EXTRA_MAX,
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
  /**
   * Por que esta opção está na lista. A vitrine mostra ISTO no lugar do nome do
   * serviço: ".Package Centralizado · Jadlog" não diz nada para quem compra
   * camisa, "Mais barato · até 8 dias úteis" diz tudo.
   */
  tag: "barato" | "rapido" | "ambos" | "equilibrio" | null;
};

/**
 * Escolhe até 3 opções para mostrar, garantindo que a MAIS BARATA e a MAIS
 * RÁPIDA estejam entre elas.
 *
 * Antes eram simplesmente as 3 mais baratas, e isso escondia o prazo curto onde
 * ele mais importa: para Manaus as três mais baratas levam ~20 dias, então o
 * cliente disposto a pagar por rapidez nunca via a opção de 6 dias e ia embora.
 * O inverso também acontece — medido em 21/08/2026, o SEDEX para São Paulo custa
 * R$ 35,86 contra R$ 15,14 da Loggi, e para Salvador R$ 73,95 contra R$ 17,65.
 * Mostrar os dois extremos deixa o cliente decidir com a informação na mão.
 */
/**
 * A opção de EQUILÍBRIO: sobe do frete mais barato para o mais rápido, um
 * degrau por vez, enquanto cada degrau custar pouco por dia economizado.
 *
 * Em degraus, e não comparando tudo com a mais barata, porque os últimos dias
 * são sempre os mais caros — ver o comentário das constantes em
 * `shipping-config.ts`, com os números reais de Manaus.
 *
 * Quando o frete mais barato já é o mais rápido, ela é ele mesmo.
 */
function opcaoEquilibrio(todas: ShippingOption[]): ShippingOption {
  const base = [...todas].sort((a, b) => a.price - b.price || a.days - b.days)[0];
  let atual = base;
  for (;;) {
    const degraus = todas
      .filter((o) => o.days < atual.days)
      .map((o) => ({
        o,
        porDia: (o.price - atual.price) / (atual.days - o.days),
        extra: o.price - base.price,
      }))
      .filter(
        (d) =>
          d.porDia > 0 &&
          d.porDia <= FRETE_CUSTO_POR_DIA_MAX &&
          d.extra <= FRETE_EXTRA_MAX,
      )
      .sort((a, b) => a.porDia - b.porDia);
    if (degraus.length === 0) return atual;
    atual = degraus[0].o;
  }
}

function escolheOpcoes(todas: ShippingOption[]): ShippingOption[] {
  if (todas.length === 0) return [];
  // Desempates explícitos: preço igual → o mais rápido primeiro, e vice-versa.
  const porPreco = [...todas].sort(
    (a, b) => a.price - b.price || a.days - b.days,
  );
  const porPrazo = [...todas].sort(
    (a, b) => a.days - b.days || a.price - b.price,
  );
  const barato = porPreco[0];
  const rapido = porPrazo[0];

  const escolhidas: ShippingOption[] = [];
  if (barato.serviceId === rapido.serviceId) {
    // Rota curta: o mesmo serviço é o mais barato E o mais rápido.
    escolhidas.push({ ...barato, tag: "ambos" });
  } else {
    escolhidas.push({ ...barato, tag: "barato" }, { ...rapido, tag: "rapido" });
  }

  // O 3º lugar é o EQUILÍBRIO — antes era a "próxima mais barata", que podia
  // ser inútil: para Manaus entrava o PAC de R$ 44,16 em 21 dias, mais caro E
  // mais lento que a Jadlog de R$ 37,65 em 20, enquanto a LATAM (7 dias por
  // R$ 49,72) ficava escondida.
  const eq = opcaoEquilibrio(todas);
  if (!escolhidas.some((e) => e.serviceId === eq.serviceId)) {
    escolhidas.push({ ...eq, tag: "equilibrio" });
  }
  return escolhidas.sort((a, b) => a.price - b.price);
}

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
    const todas = data
      .filter((s) => !s.error && (s.custom_price ?? s.price))
      .map((s) => ({
        serviceId: s.id,
        name: s.name,
        company: s.company?.name ?? "",
        price: Number(s.custom_price ?? s.price),
        days: s.delivery_range?.max ?? s.delivery_time ?? 0,
        free: false,
        tag: null as ShippingOption["tag"],
      }))
      .filter((o) => Number.isFinite(o.price) && o.price > 0);
    const opts = escolheOpcoes(todas);
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

  // Frete grátis: quando o subtotal alcança o mínimo, TODAS as opções saem
  // grátis — não só a mais barata. Zerar só a mais barata transformava o
  // benefício numa escolha entre "grátis e devagar" ou "rápido e pago", que
  // é o oposto de recompensar quem gastou mais. Servidor decide: o cliente
  // não manda preço de frete nenhum.
  const freeApplied = FRETE_GRATIS_MIN != null && subtotal >= FRETE_GRATIS_MIN;
  if (freeApplied && options.length > 0) {
    // A loja cobre até a opção de EQUILÍBRIO. Tudo até ali sai grátis; o que
    // for mais rápido (e mais caro) cobra só a DIFERENÇA, e o cliente decide
    // se quer pagar por velocidade. Assim o custo da loja fica travado no
    // valor da cobertura, escolha ele o que escolher — zerar tudo faria a loja
    // pagar R$ 128 num pedido de Manaus onde R$ 49 entregava em 7 dias.
    const cobertura = opcaoEquilibrio(options).price;
    options = options.map((o) =>
      o.price <= cobertura
        ? { ...o, price: 0, free: true }
        : { ...o, price: o.price - cobertura, free: false },
    );
  }
  return { options, freeApplied };
}
