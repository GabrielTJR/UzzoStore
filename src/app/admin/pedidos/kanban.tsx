import Link from "next/link";
import {
  colunaKanban,
  fulfillmentLabel,
  nextFulfillmentStatus,
  podeAvancarAtendimento,
  aceitaPagamentoManual,
  type AdminOrder,
  type KanbanColuna,
} from "@/lib/admin-orders";
import { formatBRL } from "@/lib/format";
import { updateFulfillmentAction, updatePaymentStatusAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { pedidosHref } from "./href";
import { CardLink } from "./card-link";

/**
 * As colunas do quadro, na ordem em que o pedido anda.
 *
 * São 5, não as 6 etapas de `KANBAN_COLUNAS`: "pronto para retirada" e
 * "enviado" são a MESMA altura do caminho (a loja já fez a parte dela e
 * espera o cliente) para dois tipos de pedido diferentes. Em colunas separadas
 * uma das duas ficava quase sempre vazia e o quadro não cabia na tela; juntas,
 * o cartão diz qual é o caso.
 */
const COLUNAS: { label: string; dica: string; etapas: KanbanColuna[] }[] = [
  {
    label: "Aguardando pagamento",
    dica: "Ainda não pode ser separado",
    etapas: ["aguardando_pagamento"],
  },
  { label: "A separar", dica: "Pago, esperando alguém pegar", etapas: ["a_separar"] },
  { label: "Separando", dica: "Em preparo na loja", etapas: ["preparing"] },
  {
    label: "Pronto ou enviado",
    dica: "Esperando retirada ou a caminho",
    etapas: ["ready", "shipped"],
  },
  { label: "Concluído", dica: "Entregues mais recentes", etapas: ["done"] },
];

/** Quantos concluídos o quadro mostra — o histórico completo fica na lista. */
const CONCLUIDOS_NO_QUADRO = 8;

function haQuanto(iso: string, agora: number): string {
  const min = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

/** Prazo do pagamento online (a reserva da peça cai junto com ele). */
function prazo(expiresAt: string | null, agora: number): string | null {
  if (!expiresAt) return null;
  const min = Math.round((new Date(expiresAt).getTime() - agora) / 60000);
  return min > 0 ? `expira em ${min} min` : "prazo vencido";
}

const etiqueta =
  "rounded-xs bg-surface px-1.5 py-0.5 text-[0.7rem] leading-none text-muted";

/**
 * Botão do cartão: contornado, e só se preenche quando o mouse chega. Com um
 * botão preto cheio em cada cartão, o quadro eram cinco colunas de botões
 * gritando por cima do que importa ler (quem, quanto, há quanto tempo).
 */
const botaoCartao =
  "h-9 w-full rounded-xs border text-xs font-semibold";

/**
 * QUADRO DE PEDIDOS — a visão padrão de /admin/pedidos.
 *
 * Cada coluna é uma etapa do caminho do pedido; bater o olho mostra onde está
 * cada um e onde a fila está parando. O cartão traz só o que decide a ação
 * (quem, o quê, quanto, há quanto tempo) e o botão que leva à PRÓXIMA etapa.
 * O resto do pedido abre num modal, ao clicar em qualquer ponto do cartão.
 *
 * Não tem arrastar-e-soltar de propósito: avançar um pedido tem regra (o
 * atendimento só anda com pagamento confirmado, e no pedido online quem
 * confirma é o provedor, nunca um clique). Um botão por cartão deixa a regra
 * visível; um arrasto errado no celular marcaria como enviado o que não saiu.
 *
 * A lista (`?vista=lista`) continua existindo para achar pedido antigo,
 * cancelado ou expirado, que não entram no quadro.
 */
export function PedidosKanban({ orders }: { orders: AdminOrder[] }) {
  // Lido uma vez por renderização (Server Component): todos os cartões usam o
  // mesmo "agora".
  const agora = new Date().getTime();
  const colunaDe = (o: AdminOrder) =>
    colunaKanban(o.paymentStatus, o.fulfillmentStatus);
  const fora = orders.filter((o) => colunaDe(o) === null);

  if (orders.length === 0) {
    return (
      <p className="rounded-sm border border-dashed border-border bg-background p-8 text-sm text-muted">
        Nenhum pedido ainda. Eles entram aqui, na primeira coluna, assim que
        alguém fechar uma compra.
      </p>
    );
  }

  return (
    <div>
      {/* Em tela larga as 5 colunas dividem a largura toda; abaixo disso a
          fila rola na horizontal (quebrar em linhas destruiria a leitura de
          esquerda para a direita, que é o ponto do quadro).
          `relative` não é enfeite: os textos só para leitor de tela são
          `position: absolute`, e sem um ancestral posicionado AQUI DENTRO eles
          escapam do corte da rolagem — os das colunas fora da tela esticavam a
          página inteira para o lado. */}
      <div className="relative grid snap-x grid-flow-col auto-cols-[minmax(15.5rem,1fr)] gap-3 overflow-x-auto pb-4 min-[1400px]:auto-cols-fr">
        {COLUNAS.map((col, pos) => {
          const todos = orders.filter((o) => {
            const c = colunaDe(o);
            return c !== null && col.etapas.includes(c);
          });
          const ehConcluido = col.etapas.includes("done");
          const visiveis = ehConcluido
            ? todos.slice(0, CONCLUIDOS_NO_QUADRO)
            : todos;
          const soma = todos.reduce((s, o) => s + o.total, 0);

          return (
            // `border`, não `ring`: o anel é sombra, e a área de rolagem
            // horizontal cortava o da primeira e o da última coluna.
            <section
              key={col.label}
              aria-label={col.label}
              className="flex min-w-0 snap-start flex-col rounded-sm border border-border bg-background/60 p-2.5"
            >
              {/* A dica da etapa vai no `title` (aparece ao parar o mouse): em
                  texto ela disputava a linha com o valor e quebrava em duas. */}
              <header className="mb-2.5 px-1 pt-0.5" title={col.dica}>
                {/* Onde esta coluna fica no caminho: cinco traços, preenchidos
                    até ela. Rolando o quadro no celular só se vê uma coluna
                    por vez, e é o traço que diz quanto falta. */}
                <div aria-hidden className="mb-2 flex gap-[3px]">
                  {COLUNAS.map((c, k) => (
                    <span
                      key={c.label}
                      className={`h-[3px] w-4 ${
                        k <= pos ? "bg-foreground" : "bg-border"
                      }`}
                    />
                  ))}
                </div>
                <h2 className="flex items-baseline justify-between gap-2 text-sm font-semibold">
                  <span>
                    {col.label}
                    <span className="sr-only">
                      , etapa {pos + 1} de {COLUNAS.length}
                    </span>
                  </span>
                  <span
                    className={`tabular-nums ${
                      todos.length === 0 ? "font-normal text-muted" : ""
                    }`}
                  >
                    {todos.length}
                    <span className="sr-only">
                      {todos.length === 1 ? " pedido" : " pedidos"}
                    </span>
                  </span>
                </h2>
                <p className="text-xs tabular-nums text-muted">
                  {todos.length > 0 && !ehConcluido
                    ? formatBRL(soma)
                    : col.dica}
                </p>
              </header>

              <ul className="space-y-2">
                {visiveis.map((o) => {
                  const next = nextFulfillmentStatus(
                    o.fulfillmentStatus,
                    o.shippingMethod,
                  );
                  const travado = !podeAvancarAtendimento(o.paymentStatus);
                  const pecas = o.items.reduce((s, i) => s + i.qty, 0);
                  const primeiro = o.items[0];
                  // Pedido de WhatsApp pode não ter forma de entrega gravada
                  // (combinada na conversa): chamar de "Entrega" seria chute.
                  const forma =
                    o.shippingMethod === "pickup"
                      ? "Retirada"
                      : o.shippingMethod === "delivery"
                        ? "Entrega"
                        : "A combinar";
                  const expira =
                    o.paymentStatus === "pending"
                      ? prazo(o.expiresAt, agora)
                      : null;
                  // Pago, mas com o atendimento cancelado: o caso que não pode
                  // passar batido (pagamento fora do prazo, peça já devolvida).
                  const pagoCancelado =
                    o.paymentStatus === "paid" &&
                    o.fulfillmentStatus === "canceled";

                  return (
                    // O cartão inteiro abre o pedido pelo "link esticado": o
                    // link do número ganha um ::after que cobre o cartão (por
                    // isso `relative` aqui e NENHUM ancestral posicionado
                    // entre os dois). Os formulários ficam acima dele com
                    // `relative z-10` — um <a> em volta de <form>/<button> é
                    // HTML inválido e o clique no botão abriria o pedido.
                    <li
                      key={o.id}
                      className={`relative rounded-xs border bg-background p-3 transition-colors focus-within:border-foreground hover:border-foreground ${
                        o.isNew
                          ? "border-accent shadow-[inset_3px_0_0_var(--accent)]"
                          : "border-border"
                      }`}
                    >
                      {/* Três níveis: quem (o mais forte), nº e valor, e o
                          resto discreto. Na loja o pedido é "o do Fulano"
                          antes de ser um número. */}
                      <p className="truncate text-[0.95rem] font-semibold leading-snug">
                        {o.customerName ?? "Visitante sem conta"}
                      </p>
                      <p className="mt-0.5 flex items-baseline justify-between gap-2 text-sm">
                        {/* `CardLink` é o <Link> de sempre (sem rolagem, sem
                            prefetch) mais duas coisas que o modal usa ao
                            fechar: avisa que o pedido foi aberto por aqui e
                            marca o link com o número do pedido. */}
                        <CardLink
                          numero={o.number}
                          href={pedidosHref("quadro", o.number)}
                          className="font-medium after:absolute after:inset-0"
                        >
                          <span className="sr-only">Abrir o pedido </span>
                          nº {o.number}
                        </CardLink>
                        <span className="font-medium tabular-nums">
                          {formatBRL(o.total)}
                        </span>
                      </p>

                      {primeiro && (
                        <p className="mt-1.5 truncate text-xs text-muted">
                          {primeiro.productName}
                          {o.items.length > 1 &&
                            ` e mais ${o.items.length - 1}`}
                        </p>
                      )}

                      <p className="mt-1.5 flex flex-wrap items-center gap-1">
                        {o.isNew && (
                          <span className="rounded-xs bg-accent px-1.5 py-0.5 text-[0.7rem] font-bold leading-none text-accent-foreground">
                            novo
                          </span>
                        )}
                        <span className={etiqueta}>{forma}</span>
                        <span className={etiqueta}>
                          {pecas} {pecas === 1 ? "peça" : "peças"}
                        </span>
                        {o.channel === "whatsapp" && (
                          <span className={etiqueta}>WhatsApp</span>
                        )}
                        {o.fulfillmentStatus === "shipped" && (
                          <span className={etiqueta}>
                            {o.trackingCode ? "com rastreio" : "sem rastreio"}
                          </span>
                        )}
                      </p>

                      <p className="mt-1.5 text-xs text-muted">
                        {haQuanto(o.createdAt, agora)}
                        {expira && `, ${expira}`}
                      </p>

                      {pagoCancelado && (
                        <p className="mt-2 rounded-xs bg-red-600/10 px-2 py-1.5 text-xs font-medium text-red-700 dark:text-red-400">
                          Pago, mas o atendimento está cancelado. Abra o pedido
                          e resolva com o cliente.
                        </p>
                      )}

                      {/* No online o pagamento é do provedor: aqui só o
                          WhatsApp ganha botão, senão viraria porta para marcar
                          como pago o que não foi. */}
                      {travado && aceitaPagamentoManual(o.channel) && (
                        <form
                          action={updatePaymentStatusAction}
                          className="relative z-10 mt-2.5"
                        >
                          <input type="hidden" name="orderId" value={o.id} />
                          <input type="hidden" name="status" value="paid" />
                          <SubmitButton
                            pendingText="Confirmando…"
                            className={`${botaoCartao} border-green-700 text-green-700 hover:bg-green-700 hover:text-white dark:border-green-500 dark:text-green-400`}
                          >
                            Confirmar pagamento
                          </SubmitButton>
                        </form>
                      )}

                      {next && !travado && !pagoCancelado && (
                        <form
                          action={updateFulfillmentAction}
                          className="relative z-10 mt-2.5"
                        >
                          <input type="hidden" name="orderId" value={o.id} />
                          <input type="hidden" name="status" value={next} />
                          <SubmitButton
                            pendingText="Salvando…"
                            className={`${botaoCartao} border-foreground hover:bg-foreground hover:text-background`}
                          >
                            {fulfillmentLabel(next)}
                          </SubmitButton>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* Coluna vazia: uma linha, sem caixa. Vazio não é pendência e
                  não deve chamar mais atenção que uma coluna com fila. */}
              {todos.length === 0 && (
                <p className="px-1 py-2 text-xs text-muted">
                  Nenhum pedido nesta etapa
                </p>
              )}

              {ehConcluido && todos.length > visiveis.length && (
                <Link
                  href={pedidosHref("lista")}
                  prefetch={false}
                  className="mt-2 block px-1 text-xs text-muted underline underline-offset-4 hover:text-foreground"
                >
                  Mais {todos.length - visiveis.length} na lista
                </Link>
              )}
            </section>
          );
        })}
      </div>

      {fora.length > 0 && (
        <p className="mt-1 text-sm text-muted">
          {fora.length}{" "}
          {fora.length === 1
            ? "pedido cancelado, expirado ou estornado fica"
            : "pedidos cancelados, expirados ou estornados ficam"}{" "}
          fora do quadro.{" "}
          <Link
            href={pedidosHref("lista")}
            prefetch={false}
            className="text-foreground underline underline-offset-4"
          >
            Ver na lista
          </Link>
        </p>
      )}
    </div>
  );
}
