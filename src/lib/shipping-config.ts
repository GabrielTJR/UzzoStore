/**
 * Configuração de frete — módulo NEUTRO (client e server importam).
 *
 * FRETE_GRATIS_MIN: subtotal a partir do qual o frete mais barato sai grátis
 * (a barra de progresso da sacola usa este número, e o SERVIDOR aplica o
 * desconto de verdade na cotação — os dois lados leem daqui, nunca divergem).
 * `null` desliga a promoção. ⚠️ Valor é decisão do dono — ajuste aqui.
 */
export const FRETE_GRATIS_MIN: number | null = 299;

/**
 * Peso padrão por categoria (em GRAMAS) quando o produto não tem
 * `weight_grams` cadastrado. Chutes conservadores para roupa embalada —
 * peso a MENOS gera cobrança por divergência depois (a reclamação nº 1
 * contra as plataformas de frete), então na dúvida arredondamos para cima.
 */
const PESO_POR_CATEGORIA: [RegExp, number][] = [
  [/camiseta|polo|regata/i, 350],
  [/camisa/i, 400],
  [/bermuda|shorts/i, 450],
  [/cal[cç]a/i, 650],
  [/moletom|sueter|su[eé]ter|tricot/i, 700],
  [/jaqueta|casaco|corta[- ]?vento|puffer|bomber/i, 900],
  [/sapato|t[eê]nis|cal[cç]ado/i, 1100],
  [/cueca|meia|kit|acess/i, 300],
];
const PESO_PADRAO = 500;

export function pesoPadraoGramas(categoryName: string | null): number {
  if (categoryName) {
    for (const [re, g] of PESO_POR_CATEGORIA)
      if (re.test(categoryName)) return g;
  }
  return PESO_PADRAO;
}

/**
 * Caixa da encomenda a partir do nº de peças: base 36×27 cm e altura que
 * cresce com o volume (roupa comprime). Dimensões mínimas dos Correios
 * respeitadas; altura teto de 30 cm.
 */
export function caixaParaPecas(qtd: number): {
  width: number;
  height: number;
  length: number;
} {
  const altura = Math.min(30, Math.max(4, 4 + (qtd - 1) * 3));
  return { width: 27, height: altura, length: 36 };
}

/**
 * Nome do serviço em português de loja, por id do Melhor Envio.
 *
 * O que a API devolve é nome INTERNO de transportadora: ".Package Centralizado",
 * ".Com", "Standard", "éFácil". Ninguém que compra camisa sabe o que é isso, e
 * na hora de escolher frete a dúvida vira desistência. Aqui traduzimos para o
 * que a pessoa reconhece — a marca, quando ela é conhecida (SEDEX, PAC), ou a
 * transportadora mais o nível de serviço.
 *
 * A chave é o ID, não o nome: o id é estável e o nome a Melhor Envio pode mudar
 * quando quiser. Levantado em 21/08/2026 de `/api/v2/me/shipment/services`, que
 * devolveu 15 serviços. Para conferir se surgiu algum novo, chame esse endpoint.
 *
 * Os ids 3 e 27 caem no mesmo rótulo de propósito: para o cliente são o mesmo
 * produto (Jadlog econômico), e o que os separa — prazo e preço — já aparece na
 * mesma linha.
 */
const NOME_SERVICO: Record<number, string> = {
  1: "Correios PAC",
  2: "Correios SEDEX",
  3: "Jadlog Econômico",
  4: "Jadlog Expresso",
  12: "LATAM Cargo",
  15: "Azul Cargo Expresso",
  16: "Azul Cargo",
  17: "Correios Mini Envios",
  22: "Buslog Rodoviário",
  27: "Jadlog Econômico",
  31: "Loggi Expresso",
  32: "Loggi Coleta",
  33: "JeT Padrão",
  34: "Loggi Ponto",
  35: "Total Express",
};

/**
 * Nome de exibição de um serviço de frete. Cai num fallback seguro quando a
 * Melhor Envio adiciona serviço novo: tira o ponto do jargão (".Package" ->
 * "Package") e põe a transportadora na frente, a menos que o nome já comece com
 * ela ("Loggi Ponto" não vira "Loggi Loggi Ponto"). Nunca devolve vazio.
 */
/**
 * Slug de cada transportadora no Melhor Rastreio. SÓ as que ele cobre — o
 * serviço rastreia as parceiras da Melhor Envio (Correios, Jadlog, Loggi, Azul
 * Cargo, LATAM Cargo e Buslog), e JeT e Total Express ficam de fora. Para essas
 * é melhor não oferecer link nenhum do que mandar o cliente para uma busca que
 * nunca acha a encomenda dele.
 */
const SLUG_RASTREIO: [RegExp, string][] = [
  [/correios/i, "correios"],
  [/jadlog/i, "jadlog"],
  [/loggi/i, "loggi"],
  [/azul/i, "azul"],
  [/latam/i, "latam"],
  [/buslog/i, "buslog"],
];

/** Formato de objeto dos Correios: AA123456789BR. */
const CODIGO_CORREIOS = /^[A-Z]{2}\d{9}BR$/;

/**
 * Para onde mandar o cliente rastrear. Devolve também o nome da transportadora,
 * porque quando não há link ele precisa ao menos saber ONDE procurar.
 *
 * `servico` é o texto gravado em `orders.shipping_service`, no formato
 * "SEDEX (Correios)" — a transportadora sai do parêntese.
 *
 * Por que não só Correios: medido em 21/08/2026, para São Paulo, Rio, Salvador
 * e Manaus a opção mais barata é Loggi, Jadlog ou JeT. Ou seja, a maior parte
 * dos envios para fora da região NÃO é Correios, e antes disso esses clientes
 * recebiam um código solto e nenhum lugar para colar.
 *
 * Verificado no ar: `melhorrastreio.com.br/app/<slug>/<codigo>` é a rota real
 * (foi a que o próprio site gerou ao pesquisar um código). Quando o formato do
 * código identifica a transportadora, o site corrige o slug sozinho; quando não,
 * obedece o que mandamos. Slug errado cai em "não encontrado" numa página de
 * rastreio de verdade — degrada, não quebra.
 */
export function linkRastreio(
  codigo: string | null | undefined,
  servico: string | null | undefined,
): { url: string | null; transportadora: string | null } {
  const cod = (codigo ?? "").trim().toUpperCase();
  if (!cod) return { url: null, transportadora: null };

  const transportadora = (servico ?? "").match(/\(([^)]+)\)\s*$/)?.[1]?.trim() ?? null;

  // Correios tem site próprio e estável: prefere o oficial ao intermediário.
  if (CODIGO_CORREIOS.test(cod)) {
    return {
      url: `https://rastreamento.correios.com.br/app/index.php?objeto=${encodeURIComponent(cod)}`,
      transportadora: transportadora ?? "Correios",
    };
  }

  const alvo = transportadora ?? servico ?? "";
  for (const [re, slug] of SLUG_RASTREIO) {
    if (re.test(alvo)) {
      return {
        url: `https://melhorrastreio.com.br/app/${slug}/${encodeURIComponent(cod)}`,
        transportadora,
      };
    }
  }
  return { url: null, transportadora };
}

export function nomeServicoFrete(
  serviceId: number,
  name: string,
  company: string,
): string {
  const curado = NOME_SERVICO[serviceId];
  if (curado) return curado;

  const limpo = (name ?? "").replace(/^\.+/, "").trim();
  const marca = (company ?? "").trim();
  if (!limpo) return marca || "Envio";
  if (!marca) return limpo;
  return limpo.toLowerCase().startsWith(marca.toLowerCase())
    ? limpo
    : `${marca} ${limpo}`;
}
