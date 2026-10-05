import {
  PAYMENT_STATUS,
  FULFILLMENT_STATUS,
  fulfillmentSteps,
  nextFulfillmentStatus,
  fulfillmentLabel,
  podeAvancarAtendimento,
  aceitaPagamentoManual,
  situacaoCliente,
  isPaymentStatus,
  isFulfillmentStatus,
  type AdminOrder,
  type FulfillmentStatus,
} from "@/lib/admin-orders";
import { formatBRL } from "@/lib/format";
import { linkRastreio } from "@/lib/shipping-config";
import { IconChat, IconExternal } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import {
  updateFulfillmentAction,
  updatePaymentStatusAction,
  updateOrderTrackingAction,
} from "../actions";

const PAGAMENTO_STYLE: Record<string, string> = {
  pending: "border-amber-500 text-amber-700 dark:text-amber-400",
  paid: "border-green-600 text-green-700 dark:text-green-400",
  expired: "border-border text-muted line-through",
  refunded: "border-blue-500 text-blue-700 dark:text-blue-400",
  canceled: "border-border text-muted line-through",
};

const selo = "rounded-xs border px-2 py-0.5 text-xs font-medium";

/** Linha entre uma seção e a de cima. */
const divisa = "border-t border-border pt-4";

/**
 * Data e hora no fuso da LOJA. O servidor roda em UTC: sem o `timeZone`, um
 * pedido das 21h30 aparecia no painel como 00h30 do dia seguinte.
 */
const quando = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/**
 * Conversa no WhatsApp a partir do telefone como o cliente digitou. O `wa.me`
 * exige o número com o país; o cadastro guarda DDD + número. Formato que não
 * dá para reconhecer fica sem link — número errado abre conversa com um
 * desconhecido.
 */
function linkWhatsApp(phone: string | null): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `https://wa.me/55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55"))
    return `https://wa.me/${d}`;
  return null;
}

/** O endereço em linhas, pulando o que o pedido não tem. */
function linhasEndereco(a: NonNullable<AdminOrder["shippingAddress"]>): string[] {
  const rua = [a.street, a.number].filter(Boolean).join(", ");
  const cidade = [a.city, a.state].filter(Boolean).join("/");
  return [
    [rua, a.complement].filter(Boolean).join(" — "),
    [a.district, cidade].filter(Boolean).join(", "),
    a.cep ? `CEP ${a.cep}` : "",
  ].filter(Boolean);
}

function Secao({
  id,
  titulo,
  nota,
  className = "",
  children,
}: {
  id: string;
  titulo: string;
  /** Complemento discreto ao lado do título (ex.: quantas peças). */
  nota?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={className}>
      <h3 id={id} className="mb-2.5 text-sm font-semibold">
        {titulo}
        {nota && <span className="ml-2 font-normal text-muted">{nota}</span>}
      </h3>
      {children}
    </section>
  );
}

/** Um dado do pedido: rótulo pequeno em cima, valor embaixo. */
function Campo({
  rotulo,
  className = "",
  children,
}: {
  rotulo: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-xs text-muted">{rotulo}</dt>
      <dd className="mt-0.5 break-words text-sm">{children}</dd>
    </div>
  );
}

/**
 * Grade de campos que se arruma sozinha: cabem quantas colunas a largura
 * deixar. O detalhe aparece em três larguras bem diferentes (modal, coluna
 * estreita da lista, celular) e ponto de quebra por tamanho de TELA erraria em
 * pelo menos uma delas.
 */
const campos = "grid gap-x-6 gap-y-3";
const camposCurtos = `${campos} grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]`;
const camposLongos = `${campos} grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]`;

/**
 * Trilha do atendimento: as quatro etapas do caminho (que muda entre retirada
 * e entrega), com a régua preenchida até onde o pedido chegou. É o mesmo
 * desenho do indicador no cabeçalho das colunas do quadro.
 */
function Trilha({ order: o }: { order: AdminOrder }) {
  const etapas = fulfillmentSteps(o.shippingMethod);
  const cancelado = o.fulfillmentStatus === "canceled";
  const atual = etapas.indexOf(o.fulfillmentStatus as FulfillmentStatus);
  return (
    <ol className="grid grid-cols-4 gap-1.5">
      {etapas.map((s, i) => {
        const alcancada = !cancelado && atual >= i;
        const aqui = !cancelado && atual === i;
        return (
          <li
            key={s}
            aria-current={aqui ? "step" : undefined}
            className={`border-t-[3px] pt-1.5 text-xs leading-tight ${
              alcancada ? "border-foreground" : "border-border text-muted"
            } ${aqui ? "font-semibold" : ""}`}
          >
            {FULFILLMENT_STATUS[s]}
            {alcancada && !aqui && <span className="sr-only"> (feita)</span>}
            {aqui && <span className="sr-only"> (etapa atual)</span>}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * DETALHE DO PEDIDO — a fonte única do que o painel mostra e deixa fazer com
 * um pedido. É o MESMO componente na lista (`?vista=lista`) e no modal que o
 * quadro abre (`?pedido=<número>`): botão escrito em dois lugares é regra que
 * um dia diverge, e aqui divergir é marcar como pago o que não foi.
 *
 * As regras NÃO moram aqui. Vêm de `lib/admin-orders.ts` (quando o atendimento
 * pode avançar, quem aceita pagamento manual) e cada server action as confere
 * de novo no servidor — este arquivo só decide o que aparece.
 *
 * LAYOUT. Estreito (modal, celular): uma coluna, na ordem em que a loja lê um
 * pedido — situação, cliente, itens, valores, entrega, ações. Largo (o cartão
 * da lista no desktop): duas colunas, o pedido à esquerda (situação, itens,
 * valores) e a pessoa à direita (cliente, entrega, ações); em uma coluna só
 * cada pedido ocupava uma tela inteira e a lista deixava de ser lista. Quem
 * decide é a largura do PRÓPRIO detalhe (container query), não a da tela.
 *
 * As duas colunas são dois blocos no HTML; no estreito eles viram
 * `display: contents` e a ordem de leitura vem das classes `order-*`. A ordem
 * do Tab é a mesma nos dois arranjos (cliente, entrega, ações): as seções que
 * trocam de lugar não têm nada focável.
 */
export function OrderDetail({
  order: o,
  idPrefix,
}: {
  order: AdminOrder;
  /**
   * A lista e o modal podem estar na página ao mesmo tempo
   * (`?vista=lista&pedido=…`), com o mesmo pedido nos dois. O prefixo evita
   * `id` repetido: o rótulo do rastreio focaria o campo do outro.
   */
  idPrefix: string;
}) {
  const uid = `${idPrefix}-${o.id}`;
  const next = nextFulfillmentStatus(o.fulfillmentStatus, o.shippingMethod);
  // O eixo físico não anda sem o dinheiro dentro.
  const travado = !podeAvancarAtendimento(o.paymentStatus);
  const cancelado = o.fulfillmentStatus === "canceled";
  // Pago, mas com o atendimento cancelado: o caso que não pode passar batido.
  const pagoCancelado = o.paymentStatus === "paid" && cancelado;
  const retirada = o.shippingMethod === "pickup";
  const entrega = o.shippingMethod === "delivery";

  // As mesmas condições de sempre, só com nome: o que aparece em "Ações".
  const podeConfirmar =
    aceitaPagamentoManual(o.channel) && o.paymentStatus !== "paid";
  const podeCancelar = !cancelado && o.fulfillmentStatus !== "done";
  const temAcao = podeConfirmar || next !== null || podeCancelar;

  const pecas = o.items.reduce((s, i) => s + i.qty, 0);
  // Mesma conta que grava o pedido (`createOrderAction`): soma das linhas.
  const subtotal = o.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const temFrete = entrega || o.shippingService !== null || o.shippingCost > 0;

  const whats = linkWhatsApp(o.customerPhone);
  const rastreio = linkRastreio(o.trackingCode, o.shippingService);
  const endereco = o.shippingAddress ? linhasEndereco(o.shippingAddress) : [];

  return (
    <div className="@container">
      <div className="flex flex-col gap-4 @4xl:grid @4xl:grid-cols-[minmax(0,1fr)_21rem] @4xl:gap-x-6">
        {/* ---------- o pedido ---------- */}
        <div className="contents @4xl:flex @4xl:min-w-0 @4xl:flex-col @4xl:gap-4">
          {/* Dois eixos separados: o dinheiro e o trabalho físico. Um botão só
              para os dois foi o que produziu pedido "pago" sem pagamento. */}
          <Secao
            id={`${uid}-situacao`}
            titulo="Situação"
            className="order-1"
          >
            {pagoCancelado && (
              <p className="mb-3 rounded-xs bg-red-600/10 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-400">
                Pago, mas o atendimento está cancelado. Resolva com o cliente:
                estorno ou reposição da peça.
              </p>
            )}
            <dl className={camposLongos}>
              <Campo rotulo="Pagamento">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`${selo} ${
                      PAGAMENTO_STYLE[o.paymentStatus] ??
                      "border-border text-muted"
                    }`}
                  >
                    {isPaymentStatus(o.paymentStatus)
                      ? PAYMENT_STATUS[o.paymentStatus]
                      : o.paymentStatus}
                  </span>
                  <span className="text-xs text-muted">
                    {aceitaPagamentoManual(o.channel)
                      ? "manual, a loja confirma o que recebeu por fora do site"
                      : "automático, quem confirma é a InfinitePay"}
                  </span>
                </span>
                {o.expiresAt && o.paymentStatus === "pending" && (
                  <span className="mt-1 block text-xs text-muted">
                    Expira em {quando.format(new Date(o.expiresAt))}; a reserva
                    da peça cai junto.
                  </span>
                )}
              </Campo>

              <Campo rotulo="Como o cliente vê">
                {situacaoCliente(o.paymentStatus, o.fulfillmentStatus)}
              </Campo>

              <Campo rotulo="Atendimento" className="col-span-full">
                <span
                  className={`${selo} inline-block ${
                    cancelado
                      ? "border-red-600 text-red-700 dark:text-red-400"
                      : "border-border"
                  }`}
                >
                  {isFulfillmentStatus(o.fulfillmentStatus)
                    ? FULFILLMENT_STATUS[o.fulfillmentStatus]
                    : o.fulfillmentStatus}
                </span>
                <div className="mt-2.5">
                  <Trilha order={o} />
                </div>
              </Campo>

              <Campo rotulo="Recebido em">
                {quando.format(new Date(o.createdAt))}
              </Campo>
              <Campo rotulo="Canal">
                {o.channel === "online"
                  ? "Site, com pagamento online"
                  : "WhatsApp, pagamento combinado com a loja"}
              </Campo>
            </dl>
          </Secao>

          <Secao
            id={`${uid}-itens`}
            titulo="Itens"
            nota={`${pecas} ${pecas === 1 ? "peça" : "peças"}`}
            className={`order-3 ${divisa}`}
          >
            {o.items.length === 0 ? (
              <p className="text-sm text-muted">
                Este pedido não tem itens registrados.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th scope="col" className="pb-1.5 font-normal">
                      Peça
                    </th>
                    {/* No celular a quantidade e o unitário descem para baixo
                        do nome: quatro colunas não cabem em 360px. */}
                    <th
                      scope="col"
                      className="hidden pb-1.5 pl-3 text-right font-normal sm:table-cell"
                    >
                      Qtd.
                    </th>
                    <th
                      scope="col"
                      className="hidden pb-1.5 pl-3 text-right font-normal sm:table-cell"
                    >
                      Unitário
                    </th>
                    <th
                      scope="col"
                      className="pb-1.5 pl-3 text-right font-normal"
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border border-y border-border">
                  {o.items.map((i, k) => (
                    <tr key={k} className="align-top">
                      <td className="py-2">
                        <span className="font-medium">{i.productName}</span>
                        {i.variantLabel && (
                          <span className="block text-xs text-muted">
                            {i.variantLabel}
                          </span>
                        )}
                        <span className="block text-xs tabular-nums text-muted sm:hidden">
                          {i.qty} × {formatBRL(i.unitPrice)}
                        </span>
                      </td>
                      <td className="hidden py-2 pl-3 text-right tabular-nums sm:table-cell">
                        {i.qty}
                      </td>
                      <td className="hidden whitespace-nowrap py-2 pl-3 text-right tabular-nums sm:table-cell">
                        {formatBRL(i.unitPrice)}
                      </td>
                      <td className="whitespace-nowrap py-2 pl-3 text-right tabular-nums">
                        {formatBRL(i.unitPrice * i.qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Secao>

          {/* Em largura inteira de propósito: os valores caem na mesma coluna
              dos totais de linha logo acima, e a conta se lê de cima a baixo. */}
          <Secao
            id={`${uid}-valores`}
            titulo="Valores"
            className={`order-4 ${divisa}`}
          >
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tabular-nums">{formatBRL(subtotal)}</dd>
              </div>
              {(o.discount > 0 || o.couponCode) && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">
                    {o.couponCode ? `Cupom ${o.couponCode}` : "Desconto"}
                  </dt>
                  <dd className="tabular-nums">−{formatBRL(o.discount)}</dd>
                </div>
              )}
              {temFrete && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Frete</dt>
                  <dd className="tabular-nums">
                    {o.shippingCost > 0
                      ? formatBRL(o.shippingCost)
                      : o.shippingService
                        ? "grátis"
                        : "a combinar"}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-border pt-1.5 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatBRL(o.total)}</dd>
              </div>
            </dl>
          </Secao>
        </div>

        {/* ---------- a pessoa: quem, para onde, o que fazer ---------- */}
        <div className="contents @4xl:flex @4xl:min-w-0 @4xl:flex-col @4xl:gap-4 @4xl:border-l @4xl:border-border @4xl:pl-6">
          <Secao
            id={`${uid}-cliente`}
            titulo="Cliente"
            // No largo é o topo da coluna da direita: sem linha em cima.
            className={`order-2 ${divisa} @4xl:border-t-0 @4xl:pt-0`}
          >
            <dl className={camposCurtos}>
              <Campo rotulo="Nome">
                {o.customerName ?? "Visitante sem conta"}
              </Campo>
              <Campo rotulo="Telefone">
                {!o.customerPhone ? (
                  <span className="text-muted">Não informado</span>
                ) : whats ? (
                  <a
                    href={whats}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 underline underline-offset-4"
                  >
                    <IconChat size={15} />
                    {o.customerPhone}
                    <span className="sr-only">
                      {" "}
                      (abre a conversa no WhatsApp)
                    </span>
                  </a>
                ) : (
                  o.customerPhone
                )}
              </Campo>
              <Campo rotulo="CPF">
                {o.customerCpf ?? (
                  <span className="text-muted">Não informado</span>
                )}
              </Campo>
            </dl>
            {!o.customerName && !o.customerPhone && o.channel === "whatsapp" && (
              <p className="mt-2 text-xs text-muted">
                Pedido fechado sem conta: o contato está na conversa do WhatsApp
                em que o cliente citou o nº {o.number}.
              </p>
            )}
          </Secao>

          {/* Entrega: sem isso não dá para saber se retira ou para onde enviar. */}
          <Secao
            id={`${uid}-entrega`}
            titulo="Entrega"
            className={`order-5 ${divisa}`}
          >
            <dl className={camposCurtos}>
              <Campo rotulo="Forma">
                {retirada
                  ? "Retirada na loja"
                  : entrega
                    ? "Entrega"
                    : "A combinar pelo WhatsApp"}
              </Campo>
              {entrega && (
                // O nome CRU do serviço, como veio do Melhor Envio: é por ele
                // que se acha a opção no painel de lá ao comprar a etiqueta.
                <Campo rotulo="Serviço de frete">
                  {o.shippingService ?? (
                    <span className="text-muted">A combinar com o cliente</span>
                  )}
                </Campo>
              )}
              {entrega && (
                <Campo
                  rotulo={
                    o.shippingAddress?.label
                      ? `Endereço (${o.shippingAddress.label})`
                      : "Endereço"
                  }
                  className="col-span-full"
                >
                  {endereco.length > 0 ? (
                    endereco.map((linha, k) => (
                      <span key={k} className="block">
                        {linha}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted">
                      O pedido não guardou endereço. Combine com o cliente.
                    </span>
                  )}
                </Campo>
              )}
              {/* Pedido cancelado não edita mais o rastreio, mas o código que
                  já existia continua à vista. */}
              {entrega && cancelado && o.trackingCode && (
                <Campo rotulo="Código de rastreio" className="col-span-full">
                  <span className="font-mono text-xs">{o.trackingCode}</span>
                </Campo>
              )}
            </dl>

            {/* Rastreio: salve ANTES de avançar para "enviado" — o e-mail ao
                cliente sai com o link do código que estiver salvo aqui. */}
            {entrega && !cancelado && (
              <div className="mt-3">
                <form
                  action={updateOrderTrackingAction}
                  className="flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="orderId" value={o.id} />
                  <div>
                    <label
                      htmlFor={`${uid}-rastreio`}
                      className="block text-xs text-muted"
                    >
                      Código de rastreio
                    </label>
                    <input
                      id={`${uid}-rastreio`}
                      name="tracking"
                      defaultValue={o.trackingCode ?? ""}
                      placeholder="AA123456789BR"
                      className="mt-0.5 h-9 w-48 rounded-xs border border-border bg-transparent px-3 font-mono text-xs uppercase outline-none focus:border-foreground"
                    />
                  </div>
                  <SubmitButton
                    pendingText="…"
                    className="h-9 rounded-xs border border-border px-4 text-xs font-medium hover:border-foreground"
                  >
                    Salvar
                  </SubmitButton>
                  {rastreio.url && (
                    <a
                      href={rastreio.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center gap-1.5 text-xs underline underline-offset-4"
                    >
                      <IconExternal size={14} />
                      Abrir rastreio
                    </a>
                  )}
                </form>
                {(o.fulfillmentStatus === "pending" ||
                  o.fulfillmentStatus === "preparing") && (
                  <p className="mt-1.5 text-xs text-muted">
                    Salve o código antes de marcar como enviado: o e-mail ao
                    cliente sai com o que estiver gravado aqui.
                  </p>
                )}
              </div>
            )}
          </Secao>

          <Secao
            id={`${uid}-acoes`}
            titulo="Ações"
            className={`order-6 ${divisa}`}
          >
            {/* Pedido encerrado (concluído ou cancelado) não tem mais o que
                fazer além de corrigir: sem a fileira, não sobra um vão. */}
            {temAcao && (
              <div className="mb-3 flex flex-wrap items-center gap-3">
                {/* No online o pagamento é do provedor: só o WhatsApp ganha
                    botão, senão viraria porta para marcar como pago o que não
                    foi. */}
                {podeConfirmar && (
                  <form action={updatePaymentStatusAction}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <input type="hidden" name="status" value="paid" />
                    <SubmitButton
                      pendingText="Confirmando…"
                      className="h-9 rounded-xs border border-green-700 px-5 text-sm font-semibold text-green-700 hover:bg-green-700 hover:text-white dark:border-green-500 dark:text-green-400"
                    >
                      Confirmar pagamento
                    </SubmitButton>
                  </form>
                )}

                {next && travado && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    O atendimento só avança depois do pagamento confirmado.
                  </p>
                )}
                {next && !travado && (
                  <form action={updateFulfillmentAction}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <input type="hidden" name="status" value={next} />
                    <SubmitButton
                      pendingText="Salvando…"
                      className="h-9 rounded-xs bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90"
                    >
                      {fulfillmentLabel(next)}
                    </SubmitButton>
                  </form>
                )}

                {podeCancelar && (
                  <form action={updateFulfillmentAction}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <input type="hidden" name="status" value="canceled" />
                    {/* Continua com cara de link, mas com a ALTURA dos botões
                        ao lado: este detalhe é também a folha de tela cheia do
                        celular, e um texto de 20px colado no botão principal
                        cancelava pedido por toque errado. */}
                    <SubmitButton
                      pendingText="Cancelando…"
                      className="inline-flex h-9 items-center text-sm text-red-600 underline-offset-4 hover:underline dark:text-red-400"
                    >
                      Cancelar pedido
                    </SubmitButton>
                  </form>
                )}
              </div>
            )}

            {/* Correção manual do ATENDIMENTO. O pagamento não entra aqui: no
                online ele é do provedor, e no WhatsApp já tem o botão próprio
                acima. */}
            <details className="text-xs text-muted">
              {/* O `py` é área de toque, não respiro: a linha de texto sozinha
                  tem 16px de altura. A margem negativa devolve o espaço, para
                  a seção não crescer por causa dele. `list-item` fica como
                  está (flex aqui apagaria a setinha do <summary>). */}
              <summary className="-my-2.5 cursor-pointer select-none py-2.5 hover:text-foreground">
                Corrigir atendimento
              </summary>
              {/* No celular os botões têm altura de toque (36px); no desktop
                  voltam ao tamanho discreto. São de efeito imediato, e
                  "Concluído" fica ao lado de "Cancelado". `relative` para
                  ficarem por cima da área de toque do <summary>, que avança
                  2px sobre a fileira. */}
              <div className="relative mt-2 flex flex-wrap gap-2">
                {(
                  Object.keys(
                    FULFILLMENT_STATUS,
                  ) as (keyof typeof FULFILLMENT_STATUS)[]
                ).map((s) => (
                  <form key={s} action={updateFulfillmentAction}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <input type="hidden" name="status" value={s} />
                    <SubmitButton
                      disabled={o.fulfillmentStatus === s}
                      pendingText="…"
                      className="h-9 rounded-xs border border-border px-3 text-xs text-foreground hover:border-foreground disabled:opacity-40 sm:h-7"
                    >
                      {FULFILLMENT_STATUS[s]}
                    </SubmitButton>
                  </form>
                ))}
              </div>
            </details>
          </Secao>
        </div>
      </div>
    </div>
  );
}
