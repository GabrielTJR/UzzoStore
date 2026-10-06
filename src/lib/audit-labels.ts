import { FULFILLMENT_STATUS, PAYMENT_STATUS } from "@/lib/admin-orders";

/**
 * Tradução do `audit_log` para gente: área, "é ruído automático?" e a FRASE de
 * cada evento.
 *
 * O log grava códigos técnicos (`order.fulfillment`, `shipping.quote`) porque é
 * por eles que os freios contam e que um desenvolvedor procura. Quem abre o
 * Registro de atividades é o dono da loja, que quer ler "Gabriel avançou o
 * pedido nº 1007 para Enviado". Esta tabela é o único lugar que conhece os
 * códigos — ao criar um `logAudit` novo, cadastre a ação aqui. Ação esquecida
 * não quebra nada: cai em "Sistema" com uma frase genérica e o código à mostra.
 */

export const AREAS = {
  vendas: "Vendas",
  catalogo: "Catálogo",
  vitrine: "Vitrine",
  acesso: "Acesso e equipe",
  sistema: "Sistema",
} as const;

export type Area = keyof typeof AREAS;

export function isArea(v: unknown): v is Area {
  return typeof v === "string" && v in AREAS;
}

/** Contexto que a frase usa — tudo já resolvido pela consulta. */
export type EventoCtx = {
  /** Nome curto de quem fez ("Gabriel"); `null` = automático. */
  quem: string | null;
  /** Rótulo do item (nome do produto, "nº 1007", nome da cor…). */
  item: string | null;
  /** Nome da cor envolvida, quando a consulta conseguiu resolver. */
  cor: string | null;
  meta: Record<string, unknown>;
};

type Acao = {
  area: Area;
  /** Ruído automático (cotação, e-mail enviado, contador de freio): fica
   * escondido por padrão para não enterrar o que alguém fez. */
  auto?: boolean;
  /** Nome curto da ação — é o que a busca por texto casa ("pedido", "foto"). */
  rotulo: string;
  frase: (c: EventoCtx) => string;
};

const dinheiro = (v: unknown) =>
  typeof v === "number"
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : null;

const sujeito = (c: EventoCtx) => c.quem ?? "Alguém";
const pedido = (c: EventoCtx) => (c.item ? `o pedido ${c.item}` : "um pedido");
const produto = (c: EventoCtx) => (c.item ? `“${c.item}”` : "um produto");
/** " (Azul)" quando a cor é conhecida. */
const naCor = (c: EventoCtx) => (c.cor ? ` (${c.cor})` : "");
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

const SECAO: Record<string, string> = {
  aviso: "faixa de aviso",
  banner: "banner",
  mosaico: "mosaico",
  vitrine: "vitrine",
};
const secao = (c: EventoCtx) => (c.item ? (SECAO[c.item] ?? c.item) : "bloco");

/** Valores da coluna `status` única de antes da 0016 (pagamento e
 * atendimento misturados). */
const SITUACAO_ANTIGA: Record<string, string> = {
  ...FULFILLMENT_STATUS,
  ...PAYMENT_STATUS,
  delivered: "Entregue",
};

const ACOES: Record<string, Acao> = {
  // ── Vendas ────────────────────────────────────────────────────────────────
  "order.create": {
    area: "vendas",
    rotulo: "Pedido criado",
    frase: (c) => {
      const canal =
        c.meta.canal === "online"
          ? "para pagar no site"
          : c.meta.canal === "whatsapp"
            ? "pelo WhatsApp"
            : null;
      const total = dinheiro(c.meta.total);
      return [
        `Novo pedido ${c.item ?? ""}`.trim(),
        canal,
        total ? `— ${total}` : null,
      ]
        .filter(Boolean)
        .join(" ");
    },
  },
  "order.fulfillment": {
    area: "vendas",
    rotulo: "Pedido avançado",
    frase: (c) => {
      const s = str(c.meta.status);
      if (s === "canceled") return `${sujeito(c)} cancelou ${pedido(c)}`;
      const nome = s
        ? (FULFILLMENT_STATUS[s as keyof typeof FULFILLMENT_STATUS] ?? s)
        : "outra etapa";
      return `${sujeito(c)} avançou ${pedido(c)} para ${nome}`;
    },
  },
  "order.refunded": {
    area: "vendas",
    rotulo: "Pedido estornado",
    frase: (c) => `${sujeito(c)} marcou ${pedido(c)} como estornado`,
  },
  "home.draft_save": {
    area: "vitrine",
    rotulo: "Rascunho da página inicial",
    frase: (c) => `${sujeito(c)} salvou um rascunho da página inicial`,
  },
  "home.publish": {
    area: "vitrine",
    rotulo: "Página inicial publicada",
    frase: (c) => `${sujeito(c)} publicou a página inicial`,
  },
  "home.discard": {
    area: "vitrine",
    rotulo: "Rascunho descartado",
    frase: (c) => `${sujeito(c)} descartou o rascunho da página inicial`,
  },
  // Ação antiga (antes da migração 0016 separar pagamento de atendimento).
  "order.status": {
    area: "vendas",
    rotulo: "Situação do pedido",
    frase: (c) => {
      const s = str(c.meta.status);
      if (s === "canceled") return `${sujeito(c)} cancelou ${pedido(c)}`;
      const nome = s ? (SITUACAO_ANTIGA[s] ?? s) : null;
      return `${sujeito(c)} mudou ${pedido(c)}${nome ? ` para ${nome}` : " de situação"}`;
    },
  },
  "order.payment": {
    area: "vendas",
    rotulo: "Pagamento do pedido",
    frase: (c) => {
      const s = str(c.meta.status);
      if (s === "paid") return `${sujeito(c)} marcou ${pedido(c)} como pago`;
      if (s === "pending")
        return `${sujeito(c)} voltou ${pedido(c)} para aguardando pagamento`;
      const nome = s
        ? (PAYMENT_STATUS[s as keyof typeof PAYMENT_STATUS] ?? s)
        : "outra situação";
      return `${sujeito(c)} mudou o pagamento de ${pedido(c)} para ${nome}`;
    },
  },
  "order.tracking": {
    area: "vendas",
    rotulo: "Código de rastreio",
    frase: (c) =>
      str(c.meta.tracking)
        ? `${sujeito(c)} gravou o rastreio ${c.meta.tracking} ${c.item ? `no pedido ${c.item}` : "num pedido"}`
        : `${sujeito(c)} apagou o rastreio de ${pedido(c)}`,
  },
  "payment.link_failed": {
    area: "vendas",
    rotulo: "Falha no link de pagamento",
    frase: (c) =>
      `A InfinitePay recusou o link de pagamento ${c.item ? `do pedido ${c.item}` : ""}`.trim(),
  },
  // Registro do link de pagamento gerado (é por ele que "pagar de novo"
  // reaproveita o mesmo link em vez de abrir outro pedido). Automático.
  "payment.link_created": {
    area: "vendas",
    auto: true,
    rotulo: "Link de pagamento criado",
    frase: (c) =>
      `Link de pagamento criado ${c.item ? `para o pedido ${c.item}` : ""}`.trim(),
  },
  "payment.pos_estorno": {
    area: "vendas",
    rotulo: "Pagamento depois do estorno",
    frase: (c) => `Pagamento chegou para ${pedido(c)}, que já estava estornado`,
  },
  "payment.fora_do_prazo": {
    area: "vendas",
    rotulo: "Pagamento fora do prazo",
    frase: (c) =>
      `Pagamento chegou para ${pedido(c)} depois de a reserva expirar`,
  },
  "stock.shortage": {
    area: "vendas",
    rotulo: "Falta de estoque",
    frase: (c) => `Faltou estoque para ${pedido(c)}`,
  },
  "coupon.create": {
    area: "vendas",
    rotulo: "Cupom criado",
    frase: (c) => {
      const pct =
        typeof c.meta.percent === "number" ? ` (${c.meta.percent}%)` : "";
      return `${sujeito(c)} criou o cupom ${c.item ?? ""}${pct}`.trim();
    },
  },
  "coupon.toggle": {
    area: "vendas",
    rotulo: "Cupom ligado ou pausado",
    frase: (c) =>
      `${sujeito(c)} ${c.meta.active ? "ativou" : "pausou"} o cupom ${c.item ?? ""}`.trim(),
  },
  "coupon.delete": {
    area: "vendas",
    rotulo: "Cupom excluído",
    frase: (c) => `${sujeito(c)} excluiu o cupom ${c.item ?? ""}`.trim(),
  },
  "coupon.check": {
    area: "vendas",
    auto: true,
    rotulo: "Cupom testado",
    frase: () => "Um cliente testou um cupom na sacola",
  },
  "order.pay_again": {
    area: "vendas",
    auto: true,
    rotulo: "Pagar pedido pendente",
    frase: () => "Um cliente abriu de novo o pagamento de um pedido pendente",
  },
  "payment.start": {
    area: "vendas",
    auto: true,
    rotulo: "Pagamento iniciado",
    frase: () => "Um cliente tocou em pagar no checkout",
  },
  "shipping.quote": {
    area: "vendas",
    auto: true,
    rotulo: "Cotação de frete",
    frase: () => "Frete cotado por um visitante",
  },
  "checkout.address": {
    area: "vendas",
    auto: true,
    rotulo: "Endereço no checkout",
    frase: () => "Um cliente salvou o endereço no checkout",
  },
  "checkout.profile": {
    area: "vendas",
    auto: true,
    rotulo: "Dados no checkout",
    frase: () => "Um cliente salvou nome, CPF e telefone no checkout",
  },

  // ── Catálogo ──────────────────────────────────────────────────────────────
  "product.create": {
    area: "catalogo",
    rotulo: "Produto criado",
    frase: (c) => `${sujeito(c)} cadastrou o produto ${produto(c)}`,
  },
  "product.update": {
    area: "catalogo",
    rotulo: "Produto editado",
    frase: (c) => `${sujeito(c)} editou o produto ${produto(c)}`,
  },
  "product.featured": {
    area: "catalogo",
    rotulo: "Destaque da home",
    frase: (c) =>
      c.meta.featured
        ? `${sujeito(c)} pôs ${produto(c)} nos destaques`
        : `${sujeito(c)} tirou ${produto(c)} dos destaques`,
  },
  "product.delete": {
    area: "catalogo",
    rotulo: "Produto excluído",
    frase: (c) => `${sujeito(c)} excluiu o produto ${produto(c)}`,
  },
  "product_color.add": {
    area: "catalogo",
    rotulo: "Cor adicionada ao produto",
    frase: (c) =>
      `${sujeito(c)} adicionou ${c.cor ? `a cor ${c.cor}` : "uma cor"} em ${produto(c)}`,
  },
  "product_color.remove": {
    area: "catalogo",
    rotulo: "Cor removida do produto",
    frase: (c) =>
      c.cor
        ? `${sujeito(c)} removeu a cor ${c.cor} de ${produto(c)}`
        : `${sujeito(c)} removeu uma cor de ${produto(c)}`,
  },
  "variant.save": {
    area: "catalogo",
    rotulo: "Estoque alterado",
    frase: (c) => {
      const tam = str(c.meta.size);
      const qtd = typeof c.meta.qty === "number" ? c.meta.qty : null;
      const grade = [c.cor, tam].filter(Boolean).join(" ");
      return `${sujeito(c)} ajustou o estoque de ${produto(c)}${grade ? ` ${grade}` : ""}${qtd !== null ? ` para ${qtd}` : ""}`;
    },
  },
  "variant.delete": {
    area: "catalogo",
    rotulo: "Tamanho excluído",
    frase: (c) =>
      `${sujeito(c)} excluiu um tamanho de ${produto(c)}${naCor(c)}`,
  },
  "photo.add": {
    area: "catalogo",
    rotulo: "Foto adicionada",
    frase: (c) => {
      const n = typeof c.meta.count === "number" ? c.meta.count : 1;
      return `${sujeito(c)} adicionou ${n === 1 ? "1 foto" : `${n} fotos`} em ${produto(c)}${naCor(c)}`;
    },
  },
  "photo.remove": {
    area: "catalogo",
    rotulo: "Foto removida",
    frase: (c) => `${sujeito(c)} removeu uma foto de ${produto(c)}${naCor(c)}`,
  },
  "color.create": {
    area: "catalogo",
    rotulo: "Cor cadastrada",
    frase: (c) => `${sujeito(c)} cadastrou a cor ${c.item ?? ""}`.trim(),
  },
  "color.update": {
    area: "catalogo",
    rotulo: "Cor editada",
    frase: (c) => `${sujeito(c)} editou a cor ${c.item ?? ""}`.trim(),
  },
  "color.delete": {
    area: "catalogo",
    rotulo: "Cor excluída",
    frase: (c) =>
      `${sujeito(c)} excluiu ${c.item ? `a cor ${c.item}` : "uma cor"}`,
  },
  "category.create": {
    area: "catalogo",
    rotulo: "Categoria criada",
    frase: (c) => `${sujeito(c)} criou a categoria ${c.item ?? ""}`.trim(),
  },
  "category.update": {
    area: "catalogo",
    rotulo: "Categoria editada",
    frase: (c) => `${sujeito(c)} editou a categoria ${c.item ?? ""}`.trim(),
  },
  "category.delete": {
    area: "catalogo",
    rotulo: "Categoria excluída",
    frase: (c) =>
      `${sujeito(c)} excluiu ${c.item ? `a categoria ${c.item}` : "uma categoria"}`,
  },
  "measurement_model.create": {
    area: "catalogo",
    rotulo: "Tabela de medidas criada",
    frase: (c) =>
      `${sujeito(c)} criou a tabela de medidas ${c.item ?? ""}`.trim(),
  },
  "measurement_model.update": {
    area: "catalogo",
    rotulo: "Tabela de medidas editada",
    frase: (c) =>
      `${sujeito(c)} editou a tabela de medidas ${c.item ?? ""}`.trim(),
  },
  "measurement_model.delete": {
    area: "catalogo",
    rotulo: "Tabela de medidas excluída",
    frase: (c) =>
      `${sujeito(c)} excluiu ${c.item ? `a tabela de medidas ${c.item}` : "uma tabela de medidas"}`,
  },

  // ── Vitrine ───────────────────────────────────────────────────────────────
  "home_section.create": {
    area: "vitrine",
    rotulo: "Bloco da home criado",
    frase: (c) =>
      `${sujeito(c)} criou um bloco de ${secao(c)} na página inicial`,
  },
  "home_section.update": {
    area: "vitrine",
    rotulo: "Bloco da home editado",
    frase: (c) =>
      `${sujeito(c)} editou o bloco de ${secao(c)} da página inicial`,
  },
  "home_section.toggle": {
    area: "vitrine",
    rotulo: "Bloco da home ligado ou desligado",
    frase: (c) =>
      `${sujeito(c)} ${c.meta.active ? "ligou" : "desligou"} um bloco da página inicial`,
  },
  "home_section.move": {
    area: "vitrine",
    rotulo: "Bloco da home reordenado",
    frase: (c) =>
      `${sujeito(c)} moveu um bloco da página inicial para ${c.meta.dir === "up" ? "cima" : "baixo"}`,
  },
  "home_section.delete": {
    area: "vitrine",
    rotulo: "Bloco da home excluído",
    frase: (c) => `${sujeito(c)} excluiu um bloco da página inicial`,
  },
  "newsletter.subscribe": {
    area: "vitrine",
    rotulo: "Inscrição na newsletter",
    frase: (c) => `Inscrição na newsletter${c.item ? `: ${c.item}` : ""}`,
  },
  "stock_alert.create": {
    area: "vitrine",
    rotulo: "Avise-me quando chegar",
    frase: (c) =>
      `Pedido de "avise-me quando chegar"${c.item ? ` de ${c.item}` : ""}`,
  },

  // ── Acesso e equipe ───────────────────────────────────────────────────────
  "admin.check_email": {
    area: "acesso",
    auto: true,
    rotulo: "E-mail conferido no login do painel",
    frase: () => "Alguém digitou um e-mail na tela de login do painel",
  },
  "auth.login": {
    area: "acesso",
    rotulo: "Login",
    frase: (c) => `${sujeito(c)} entrou no painel`,
  },
  "admin.password_change": {
    area: "acesso",
    rotulo: "Senha trocada",
    frase: (c) => `${sujeito(c)} trocou a própria senha`,
  },
  "admin.update_name": {
    area: "acesso",
    rotulo: "Nome alterado",
    frase: (c) =>
      `${sujeito(c)} mudou o próprio nome${str(c.meta.name) ? ` para ${c.meta.name}` : ""}`,
  },
  "admin.invite": {
    area: "acesso",
    rotulo: "Pessoa adicionada à equipe",
    frase: (c) => `${sujeito(c)} adicionou ${c.item ?? "uma pessoa"} à equipe`,
  },
  "admin.role_change": {
    area: "acesso",
    rotulo: "Cargo alterado",
    frase: (c) =>
      `${sujeito(c)} mudou o cargo de ${c.item ?? "uma pessoa"}${str(c.meta.cargo) ? ` para ${c.meta.cargo}` : ""}`,
  },
  "admin.temp_password": {
    area: "acesso",
    rotulo: "Senha provisória gerada",
    frase: (c) =>
      `${sujeito(c)} gerou uma senha provisória para ${c.item ?? "uma pessoa"}`,
  },
  "measurement_model.duplicate": {
    area: "catalogo",
    rotulo: "Tabela de medidas duplicada",
    frase: (c) =>
      `${sujeito(c)} criou a tabela de medidas ${c.item ? `“${c.item}”` : ""} a partir de ${str(c.meta.from) ? `“${c.meta.from}”` : "outra"}`.replace(
        /\s+/g,
        " ",
      ),
  },
  "admin.remove": {
    area: "acesso",
    rotulo: "Pessoa removida da equipe",
    frase: (c) => `${sujeito(c)} removeu ${c.item ?? "uma pessoa"} da equipe`,
  },
  "admin.password_reset": {
    area: "acesso",
    rotulo: "Senha redefinida",
    frase: (c) => `${sujeito(c)} redefiniu a senha`,
  },
  "auth.otp_login": {
    area: "acesso",
    rotulo: "Cliente entrou com código",
    frase: (c) =>
      c.quem
        ? `Cliente ${c.quem} entrou com código por e-mail`
        : "Cliente entrou com código por e-mail",
  },
  "auth.otp_send_failed": {
    area: "acesso",
    rotulo: "Falha ao enviar código",
    frase: () => "O Supabase não conseguiu enviar um código de acesso",
  },
  "auth.otp_pwreset_failed": {
    area: "acesso",
    rotulo: "Falha na senha do código",
    frase: () => "Falhou a senha automática do primeiro acesso por código",
  },
  "auth.otp_cookie_missing": {
    area: "acesso",
    rotulo: "Sessão não gravada",
    frase: () => "Código aceito, mas a sessão não foi gravada no navegador",
  },
  "auth.otp_send": {
    area: "acesso",
    auto: true,
    rotulo: "Código de acesso enviado",
    frase: (c) => `Código de acesso enviado${c.item ? ` para ${c.item}` : ""}`,
  },
  "auth.otp_verify": {
    area: "acesso",
    auto: true,
    rotulo: "Código de acesso conferido",
    frase: (c) => `Tentativa de código${c.item ? ` de ${c.item}` : ""}`,
  },
  "auth.email_check": {
    area: "acesso",
    auto: true,
    rotulo: "E-mail consultado no login",
    frase: () => "Um visitante consultou um e-mail na tela de login",
  },

  // ── Sistema ───────────────────────────────────────────────────────────────
  "email.sent": {
    area: "sistema",
    auto: true,
    rotulo: "E-mail enviado",
    frase: (c) => `E-mail enviado${c.item ? ` para ${c.item}` : ""}`,
  },
  "email.skipped": {
    area: "sistema",
    auto: true,
    rotulo: "E-mail não enviado (sem configuração)",
    frase: (c) =>
      `E-mail não enviado${c.item ? ` para ${c.item}` : ""} — falta configurar o envio`,
  },
  "email.failed": {
    area: "sistema",
    rotulo: "Falha de e-mail",
    frase: (c) => `Falhou o envio de e-mail${c.item ? ` para ${c.item}` : ""}`,
  },
};

const GENERICA: Acao = {
  area: "sistema",
  rotulo: "Outro evento",
  frase: (c) =>
    c.quem ? `${c.quem} fez uma ação no sistema` : "Evento do sistema",
};

export function acaoInfo(action: string): Acao {
  return ACOES[action] ?? GENERICA;
}

/** A ação está cadastrada aqui? (as desconhecidas mostram o código cru) */
export function acaoConhecida(action: string): boolean {
  return action in ACOES;
}

/** Ações de uma área — para filtrar no banco. "Sistema" também leva as
 * desconhecidas, então quem filtra Sistema exclui as das outras áreas. */
export function acoesDaArea(area: Area): string[] {
  return Object.entries(ACOES)
    .filter(([, a]) => a.area === area)
    .map(([k]) => k);
}

export function acoesForaDe(area: Area): string[] {
  return Object.entries(ACOES)
    .filter(([, a]) => a.area !== area)
    .map(([k]) => k);
}

/** Ruído automático, escondido por padrão. Além destes, todo evento com
 * `entity_type = 'rate'` (contador de freio) é tratado como automático. */
export const ACOES_AUTOMATICAS = Object.entries(ACOES)
  .filter(([, a]) => a.auto)
  .map(([k]) => k);

export function eventoAutomatico(action: string, entityType: string | null) {
  return entityType === "rate" || Boolean(ACOES[action]?.auto);
}

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Ações cujo nome em português contém o termo — a busca "pedido" acha
 * `order.*` mesmo sem a palavra estar gravada em lugar nenhum. */
export function acoesQueCasam(termo: string): string[] {
  const t = semAcento(termo);
  if (!t) return [];
  return Object.entries(ACOES)
    .filter(([k, a]) => semAcento(a.rotulo).includes(t) || k.includes(t))
    .map(([k]) => k);
}

export function fraseDoEvento(action: string, ctx: EventoCtx): string {
  try {
    return acaoInfo(action).frase(ctx);
  } catch {
    // Metadata em formato inesperado nunca derruba a tela.
    return GENERICA.frase(ctx);
  }
}
