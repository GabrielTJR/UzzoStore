"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useCart, cartSubtotal } from "@/lib/cart-store";
import { useCartUi } from "@/lib/cart-ui";
import {
  maskCpf,
  maskPhone,
  onlyDigits,
  perfilCompleto,
} from "@/lib/customer-fields";
import { freteRecomendado } from "@/lib/freight-choice";
import { nomeServicoFrete } from "@/lib/shipping-config";
import { formatBRL } from "@/lib/format";
import { EmailCodeForm } from "@/components/email-code-form";
import {
  cartStockAction,
  startOnlinePaymentAction,
  type PayCode,
  type SaldoSacola,
} from "@/app/(loja)/sacola/actions";
import {
  checkCouponAction,
  quoteShippingAction,
  type QuoteResult,
} from "@/app/(loja)/sacola/shipping-actions";
import type { CustomerAddress, CustomerProfile } from "@/lib/customer";
import type { ShippingOption } from "@/lib/shipping";
import { signOutAtCheckoutAction } from "./actions";
import { StepShell, type StepEstado } from "./step-shell";
import { ENDERECO_LOJA, StepDelivery, linhasEndereco } from "./step-delivery";
import { StepProfile } from "./step-profile";
import { StepPayment, type PayErroKind } from "./step-payment";
import { cartItemsForTrack, track } from "@/lib/track";

/**
 * Checkout em UMA página, quatro passos: e-mail com código, entrega, dados e
 * pagamento. Quem não está logado vê só o passo 1 aberto (sem ser mandado
 * para /entrar — era ali que o cliente do Instagram se perdia).
 *
 * Regras que não podem regredir:
 * - Depois do código, RECARGA COMPLETA (`window.location.assign`), nunca
 *   refresh do roteador: o pós-login vira o mesmo caminho de "cliente logado abre
 *   /checkout", e o cookie recém-gravado já vai na requisição.
 * - O checkout NUNCA limpa a sacola: quem desiste na InfinitePay e volta tem
 *   de achar tudo lá. Quem limpa é a confirmação, e só com pagamento aprovado.
 * - Frete cotado só de ENDEREÇO SALVO (é o que o servidor recota), uma vez por
 *   endereço + composição da sacola. Trocar retirada/entrega não recota.
 * - Retirada nunca nasce marcada; nenhum "Outros fretes" nasce marcado
 *   (`freteRecomendado`, a mesma regra da sacola).
 * - Os passos são DERIVADOS (logado? entrega confirmada? perfil completo?), não
 *   um contador que avança: assim uma recusa do pagamento reabre o passo certo
 *   só desfazendo a condição dele.
 */

const RESERVA_MIN = 25; // reserva de 20 min + folga do pg_cron (roda a cada 5)
const WHATSAPP_HREF = "/sacola"; // o fechamento pelo WhatsApp vive na sacola

const assinaNada = () => () => {};

const PAGAMENTO_INICIADO = "uzzo-pay-started";

/** Marca a hora em que o cliente saiu para a InfinitePay (aba atual). */
function marcarPagamentoIniciado() {
  try {
    sessionStorage.setItem(PAGAMENTO_INICIADO, String(Date.now()));
  } catch {
    /* sem sessionStorage: só perde o aviso de reserva própria */
  }
}

/** O cliente iniciou um pagamento há pouco? Então a peça "sem estoque" pode
 * estar reservada para o PRÓPRIO pedido anterior dele. */
function pagamentoRecente(): boolean {
  try {
    const t = Number(sessionStorage.getItem(PAGAMENTO_INICIADO));
    return !!t && Date.now() - t < RESERVA_MIN * 60_000;
  } catch {
    return false;
  }
}

type Perfil = { fullName: string; cpf: string; phone: string };

export function CheckoutFlow({
  profile,
  addresses,
  shippingEnabled,
}: {
  profile: CustomerProfile | null;
  addresses: CustomerAddress[];
  shippingEnabled: boolean;
}) {
  const items = useCart((s) => s.items);
  const coupon = useCart((s) => s.coupon);
  const setCoupon = useCart((s) => s.setCoupon);

  // Guarda de hidratação: a sacola mora no localStorage, que o servidor não vê.
  const mounted = useSyncExternalStore(
    assinaNada,
    () => true,
    () => false,
  );

  const [entrando, setEntrando] = useState(false);
  const [perfilLocal, setPerfilLocal] = useState<Perfil | null>(null);
  const [enderecosExtras, setEnderecosExtras] = useState<CustomerAddress[]>([]);
  const [method, setMethod] = useState<"delivery" | "pickup" | null>(
    addresses.length > 0 ? "delivery" : null,
  );
  const [addressId, setAddressId] = useState<string | null>(
    addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null,
  );
  const [addrFormOpen, setAddrFormOpen] = useState(false);
  /** Chave da entrega que o cliente confirmou com "Continuar" (ver `chaveEntrega`). */
  const [confirmada, setConfirmada] = useState<string | null>(null);
  const [editando, setEditando] = useState<2 | 3 | null>(null);
  /** Cotações por `quoteKey` — é o cache: alternar retirada/entrega ou voltar
   * a um endereço já cotado não chama o servidor de novo. */
  const [quotes, setQuotes] = useState<Record<string, QuoteResult>>({});
  const [freightServiceId, setFreightServiceId] = useState<number | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [saldo, setSaldo] = useState<Record<string, SaldoSacola> | null>(null);
  const [stockTry, setStockTry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<PayErroKind | null>(null);
  const [reservaPropria, setReservaPropria] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const pendentes = useRef(new Set<string>());
  /** Cupom acabado de aplicar à mão: a revalidação logo em seguida seria a
   * mesma consulta duas vezes (e gastaria o freio de 10 por 10 min). */
  const pularCupom = useRef<string | null>(null);
  const ativoAnterior = useRef<number | null>(null);

  /* ---------- derivados ---------- */

  const logged = !!profile;
  const perfil = profile ? { ...profile, ...(perfilLocal ?? {}) } : null;
  const enderecos = [
    ...addresses,
    ...enderecosExtras.filter((e) => !addresses.some((a) => a.id === e.id)),
  ];
  const selectedAddress = enderecos.find((a) => a.id === addressId) ?? null;
  const composicao = items.map((i) => `${i.variantId}:${i.qty}`).join("|");
  const cep8 = onlyDigits(selectedAddress?.cep ?? "");
  const quoteKey =
    method === "delivery" && selectedAddress ? `${cep8}|${composicao}` : null;
  const formAberto =
    method === "delivery" && (enderecos.length === 0 || addrFormOpen);

  // Os dois casos locais (cotação desligada, CEP torto) nem vão ao servidor.
  let quote: QuoteResult | null = null;
  if (quoteKey) {
    if (!shippingEnabled) quote = { ok: false, unavailable: true };
    else if (cep8.length !== 8)
      quote = {
        ok: false,
        error: "Este endereço está com o CEP incompleto. Use outro endereço.",
      };
    else quote = quotes[quoteKey] ?? null;
  }
  const quoting =
    !!quoteKey && shippingEnabled && cep8.length === 8 && !(quoteKey in quotes);

  // Frete marcado: a escolha do cliente enquanto ela existir na lista; senão a
  // recomendada. Derivado (não gravado ao chegar a cotação) para não depender
  // da ordem em que as respostas chegam.
  const opcoes: ShippingOption[] = quote?.ok ? quote.options : [];
  const servicoEscolhido: number | null = quote?.ok
    ? opcoes.some((o) => o.serviceId === freightServiceId)
      ? freightServiceId
      : (freteRecomendado(opcoes, quote.freeApplied)?.serviceId ?? null)
    : null;
  const freightOption =
    opcoes.find((o) => o.serviceId === servicoEscolhido) ?? null;

  const entregaValida =
    method === "pickup" ||
    (method === "delivery" &&
      !!selectedAddress &&
      !formAberto &&
      !!quote &&
      !quoting &&
      (quote.ok ? servicoEscolhido != null : quote.unavailable === true));

  // "Continuar" grava ESTA chave. Mudou o método, o endereço ou (na entrega) a
  // sacola, a chave muda e o passo 2 reabre sozinho — o frete confirmado era
  // de outra cesta.
  const chaveEntrega =
    method === "pickup"
      ? "pickup"
      : method === "delivery" && selectedAddress
        ? `delivery|${selectedAddress.id}|${composicao}`
        : null;
  const entregaConfirmada = confirmada != null && confirmada === chaveEntrega;
  const sacolaMudou =
    !!selectedAddress &&
    method === "delivery" &&
    !!confirmada &&
    confirmada !== chaveEntrega &&
    confirmada.startsWith(`delivery|${selectedAddress.id}|`);

  const passo2Feito =
    logged && entregaConfirmada && entregaValida && editando !== 2;
  const passo3Feito = logged && perfilCompleto(perfil) && editando !== 3;
  const ativo = !logged ? 1 : !passo2Feito ? 2 : !passo3Feito ? 3 : 4;
  const feito = (n: number) =>
    n === 1 ? logged : n === 2 ? passo2Feito : n === 3 ? passo3Feito : false;
  const estado = (n: number): StepEstado =>
    n === ativo ? "ativo" : feito(n) ? "concluido" : "futuro";

  // Variante sem saldo lido ainda (entrou depois da última leitura) não conta
  // como falta: o efeito de estoque relê assim que a composição muda.
  const temFalta = saldo
    ? items.some((i) => i.variantId in saldo && saldo[i.variantId].qty < i.qty)
    : false;
  const subtotal = cartSubtotal(items);
  const desconto = coupon ? couponDiscount : 0;
  const frete = method === "delivery" && freightOption ? freightOption.price : 0;
  const total = Math.max(0, subtotal - desconto + frete);
  const canPay =
    ativo === 4 && items.length > 0 && !temFalta && !busy && !saindo;

  /* ---------- efeitos (todos só com login) ---------- */

  // Cotação: uma por endereço + composição. A chave identifica a requisição:
  // resposta que chega depois de o cliente trocar de endereço é guardada sob a
  // chave DELA e nunca aparece no endereço errado.
  useEffect(() => {
    if (!logged || !quoteKey || !selectedAddress) return;
    if (!shippingEnabled || cep8.length !== 8) return;
    if (quoteKey in quotes || pendentes.current.has(quoteKey)) return;
    const key = quoteKey;
    pendentes.current.add(key);
    quoteShippingAction(
      selectedAddress.cep,
      items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
    )
      .then((res) => setQuotes((q) => ({ ...q, [key]: res })))
      .catch(() =>
        setQuotes((q) => ({
          ...q,
          [key]: { ok: false, error: "Não conseguimos cotar o frete agora." },
        })),
      )
      .finally(() => pendentes.current.delete(key));
  }, [logged, quoteKey, selectedAddress, shippingEnabled, cep8, quotes, items]);

  // Cupom persistido na sacola: revalida para EXIBIR o desconto (quem decide é
  // o pedido). Freio não é recusa: mantém o cupom.
  useEffect(() => {
    if (!logged || !coupon || items.length === 0) return;
    if (pularCupom.current === coupon) {
      pularCupom.current = null;
      return;
    }
    let ignore = false;
    checkCouponAction(
      coupon,
      items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
    )
      .then((res) => {
        if (ignore) return;
        if (res.ok) {
          setCouponDiscount(res.discount);
          setCouponMsg(null);
        } else if (res.rateLimited) {
          setCouponMsg("O desconto do cupom entra no valor final.");
        } else {
          setCoupon(null);
          setCouponDiscount(0);
          setCouponMsg(`O cupom aplicado não vale mais: ${res.error}`);
        }
      })
      .catch(() => {
        /* rede: fica o que estava; o pedido revalida */
      });
    return () => {
      ignore = true;
    };
    // `composicao` resume `items` (ids + quantidades): mudar só a referência
    // não pode refazer a consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logged, coupon, composicao]);

  // Estoque da sacola: avisa a falta ANTES do toque em pagar. Resposta vazia
  // com ids enviados = leitura falhou; falha aberto (o servidor decide).
  useEffect(() => {
    if (!logged || items.length === 0) return;
    let ignore = false;
    cartStockAction(items.map((i) => i.variantId))
      .then((r) => {
        if (!ignore) setSaldo(Object.keys(r).length === 0 ? null : r);
      })
      .catch(() => {
        if (!ignore) setSaldo(null);
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logged, composicao, stockTry]);

  // Voltar da InfinitePay pelo "voltar" restaura a página do bfcache com o
  // botão em "Abrindo pagamento…" para sempre. Reabilita e relê a sacola (outra
  // aba pode tê-la mudado).
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setBusy(false);
      setSaindo(false);
      void useCart.persist.rehydrate();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  // Logado de verdade: a marca do detector de laço do EmailCodeForm cumpriu o
  // papel. Sem apagar, quem sai da conta ("trocar") no mesmo minuto veria o
  // aviso de "não conseguimos manter você conectado" sem motivo.
  useEffect(() => {
    if (!logged) return;
    try {
      sessionStorage.removeItem("uzzo-otp-ok");
    } catch {
      /* sem sessionStorage */
    }
  }, [logged]);

  // Passo ativo mudou: leva a tela e o foco ao título dele (leitor de tela
  // anuncia o passo novo; no celular o cliente não precisa caçar onde está).
  // Não na primeira montagem — quem chega não deve ser rolado.
  useEffect(() => {
    if (!mounted) return;
    const antes = ativoAnterior.current;
    ativoAnterior.current = ativo;
    if (antes == null || antes === ativo) return;
    const h = document.getElementById(`passo-${ativo}-titulo`);
    if (!h) return;
    const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    h.scrollIntoView({ block: "start", behavior: calmo ? "auto" : "smooth" });
    h.focus({ preventScroll: true });
  }, [ativo, mounted]);

  // Funil: "começou o checkout". Uma vez por abertura da página, e só com
  // sacola de verdade (a sacola persistida só existe depois de montar).
  const contouInicio = useRef(false);
  useEffect(() => {
    if (!mounted || contouInicio.current || items.length === 0) return;
    contouInicio.current = true;
    track("begin_checkout", {
      value: items.reduce((s, i) => s + i.price * i.qty, 0),
      items: cartItemsForTrack(items),
    });
  }, [mounted, items]);

  /* ---------- transições ---------- */

  const recarregar = () => window.location.assign("/checkout");

  /** Falha de cotação não é cache: ao sair do endereço/método ela some, e
   * voltar a ele tenta de novo. */
  function limparFalhasDeCotacao() {
    setQuotes((q) => {
      const n: Record<string, QuoteResult> = {};
      for (const [k, v] of Object.entries(q))
        if (v.ok || v.unavailable) n[k] = v;
      return n;
    });
  }

  function escolherMetodo(m: "delivery" | "pickup") {
    setMethod(m);
    setAviso(null);
    limparFalhasDeCotacao();
  }

  function escolherEndereco(id: string) {
    setAddressId(id);
    setAviso(null);
    limparFalhasDeCotacao();
  }

  function enderecoSalvo(a: CustomerAddress) {
    setEnderecosExtras((x) => (x.some((e) => e.id === a.id) ? x : [...x, a]));
    setAddressId(a.id);
    setAddrFormOpen(false);
    setAviso(null);
    // O CEP salvo vira o "último CEP" da sacola (pré-preenche a próxima vez).
    useCart.getState().setCep(onlyDigits(a.cep));
  }

  function tentarCotarDeNovo() {
    if (!quoteKey) return;
    const k = quoteKey;
    setQuotes((q) => {
      const n = { ...q };
      delete n[k];
      return n;
    });
  }

  function continuarEntrega() {
    if (!entregaValida || !chaveEntrega) return;
    if (servicoEscolhido != null) setFreightServiceId(servicoEscolhido);
    setConfirmada(chaveEntrega);
    setEditando(null);
    setAviso(null);
  }

  function aplicarCupom(code: string, discount: number) {
    pularCupom.current = code;
    setCoupon(code);
    setCouponDiscount(discount);
    setCouponMsg(null);
    if (errorKind === "coupon") {
      setError(null);
      setErrorKind(null);
    }
  }

  function removerCupom() {
    setCoupon(null);
    setCouponDiscount(0);
    setCouponMsg(null);
    if (errorKind === "coupon") {
      setError(null);
      setErrorKind(null);
    }
  }

  function reagir(res: { error?: string; needsLogin?: boolean; code?: PayCode }) {
    if (res.needsLogin || res.code === "login") {
      recarregar();
      return;
    }
    switch (res.code) {
      case "profile":
        setEditando(3);
        setAviso(res.error ?? "Complete seus dados para pagar.");
        return;
      case "address":
        setEditando(2);
        setConfirmada(null);
        setAviso("Escolha o endereço de entrega de novo.");
        return;
      case "freight_required":
      case "freight_changed":
      case "freight_down":
        tentarCotarDeNovo();
        setConfirmada(null);
        setAviso(
          "O valor do frete mudou. Confira as opções e toque em pagar de novo.",
        );
        return;
      case "stock":
      case "items": {
        setError(res.error ?? "Uma peça da sacola não está mais disponível.");
        setErrorKind("stock");
        setStockTry((t) => t + 1);
        setReservaPropria(pagamentoRecente());
        return;
      }
      case "coupon":
        setError(res.error ?? "O cupom não vale para este pedido.");
        setErrorKind("coupon");
        return;
      default:
        setError(res.error ?? "Não foi possível abrir o pagamento.");
        setErrorKind("other");
    }
  }

  async function handlePay() {
    if (!canPay || !method) return;
    if (method === "delivery" && !selectedAddress) return;
    setError(null);
    setErrorKind(null);
    setReservaPropria(false);
    setAviso(null);
    setBusy(true);
    let saiu = false;
    try {
      const entregaComCotacao = method === "delivery" && !!quote?.ok;
      const res = await startOnlinePaymentAction(
        items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
        method === "pickup"
          ? { method: "pickup" }
          : { method: "delivery", addressId: selectedAddress!.id },
        {
          couponCode: coupon,
          freightServiceId: entregaComCotacao ? servicoEscolhido : null,
          // O preço que a tela MOSTROU: referência para o servidor recusar
          // recotação mais cara em vez de cobrar diferente em silêncio.
          freightExpectedPrice: entregaComCotacao
            ? (freightOption?.price ?? null)
            : null,
        },
      );
      if (res.ok && res.url) {
        // Funil: "foi pagar" — saiu do site para a página da InfinitePay.
        track("add_payment_info", {
          value: total,
          coupon: coupon ?? undefined,
          items: cartItemsForTrack(items),
        });
        marcarPagamentoIniciado();
        // A sacola NÃO é limpa: se o cliente voltar sem pagar, ela está aqui.
        saiu = true;
        setSaindo(true);
        window.location.assign(res.url);
        return;
      }
      reagir(res);
    } catch {
      setError("Não foi possível abrir o pagamento.");
      setErrorKind("other");
    } finally {
      // Saindo para a InfinitePay o botão fica travado (dois toques = dois
      // pedidos); o `pageshow` o devolve se o cliente voltar.
      if (!saiu) setBusy(false);
    }
  }

  /* ---------- render ---------- */

  if (entrando)
    return (
      <p role="status" className="mt-8 text-sm text-muted">
        Entrando…
      </p>
    );

  if (!mounted) return <p className="mt-8 text-sm text-muted">Carregando…</p>;

  if (items.length === 0)
    return (
      <div className="mt-8 rounded-sm border border-dashed border-border p-6 text-sm">
        <p>Sua sacola está vazia.</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <Link
            href="/produtos"
            className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-muted"
          >
            Ver produtos
          </Link>
          {logged && (
            <Link
              href="/conta/pedidos"
              prefetch={false}
              className="inline-flex min-h-11 items-center text-muted underline underline-offset-4 hover:text-foreground"
            >
              Ver meus pedidos
            </Link>
          )}
        </div>
      </div>
    );

  /* resumos dos passos concluídos */
  const resumoEntrega =
    method === "pickup" ? (
      <>
        <p>Retirar na loja, grátis</p>
        <p>{ENDERECO_LOJA}</p>
      </>
    ) : selectedAddress ? (
      <>
        <p>{linhasEndereco(selectedAddress).slice(0, 2).join(", ")}</p>
        {freightOption ? (
          <p>
            {nomeServicoFrete(
              freightOption.serviceId,
              freightOption.name,
              freightOption.company,
            )}
            {freightOption.days > 0
              ? `, até ${freightOption.days} dias úteis`
              : ""}
            , {freightOption.price > 0 ? formatBRL(freightOption.price) : "grátis"}
          </p>
        ) : quote && !quote.ok && quote.unavailable ? (
          <p>Frete combinado pelo WhatsApp depois do pagamento</p>
        ) : null}
      </>
    ) : null;

  const resumoPerfil = perfil ? (
    <>
      <p>{perfil.fullName}</p>
      <p>
        {[
          perfil.cpf ? `CPF ${maskCpf(perfil.cpf)}` : null,
          perfil.phone ? `tel. ${maskPhone(perfil.phone)}` : null,
        ]
          .filter(Boolean)
          .join(", ")}
      </p>
    </>
  ) : null;

  const avisoEntrega =
    aviso ??
    (sacolaMudou
      ? "O frete foi recalculado porque a sacola mudou. Confira e continue."
      : null);

  const freteRotulo =
    method === "pickup"
      ? "Retirada na loja"
      : freightOption
        ? `Frete (${nomeServicoFrete(
            freightOption.serviceId,
            freightOption.name,
            freightOption.company,
          )})`
        : "Frete";
  const freteValor =
    method === "pickup" ? 0 : freightOption ? freightOption.price : null;

  return (
    <ol className="mt-8">
      <StepShell
        n={1}
        titulo="Seu e-mail"
        estado={estado(1)}
        resumo={profile?.email ? <p className="break-all">{profile.email}</p> : null}
        trocar={
          logged ? (
            // Sair é a única forma honesta de "trocar o e-mail": a sessão é
            // dessa conta. A sacola fica (localStorage).
            <form
              action={signOutAtCheckoutAction}
              onSubmit={(e) => {
                if (!window.confirm("Sair desta conta e usar outro e-mail?"))
                  e.preventDefault();
              }}
            >
              <button
                type="submit"
                className="-my-2 inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-muted"
              >
                trocar<span className="sr-only"> e-mail</span>
              </button>
            </form>
          ) : null
        }
      >
        <EmailCodeForm
          origem="checkout"
          senhaHref="/entrar?next=%2Fcheckout"
          onVerified={() => {
            setEntrando(true);
            recarregar();
          }}
        />
      </StepShell>

      <StepShell
        n={2}
        titulo="Entrega"
        estado={estado(2)}
        resumo={resumoEntrega}
        onTrocar={() => {
          setEditando(2);
          setConfirmada(null);
        }}
      >
        <StepDelivery
          method={method}
          onMethod={escolherMetodo}
          enderecos={enderecos}
          addressId={addressId}
          onAddress={escolherEndereco}
          formAberto={formAberto}
          onOpenForm={() => setAddrFormOpen(true)}
          onCloseForm={() => setAddrFormOpen(false)}
          onAddressSaved={enderecoSalvo}
          onNeedsLogin={recarregar}
          quote={quote}
          quoting={quoting}
          servicoEscolhido={servicoEscolhido}
          onFrete={(o) => setFreightServiceId(o.serviceId)}
          onRetry={tentarCotarDeNovo}
          entregaValida={entregaValida}
          onContinue={continuarEntrega}
          aviso={avisoEntrega}
          whatsappHref={WHATSAPP_HREF}
        />
      </StepShell>

      <StepShell
        n={3}
        titulo="Seus dados"
        estado={estado(3)}
        resumo={resumoPerfil}
        onTrocar={() => setEditando(3)}
      >
        {aviso && (
          <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
            {aviso}
          </p>
        )}
        <StepProfile
          inicial={perfil}
          onSaved={(p) => {
            setPerfilLocal(p);
            setEditando(null);
            setAviso(null);
          }}
          onCancel={
            perfilCompleto(perfil) ? () => setEditando(null) : undefined
          }
          onNeedsLogin={recarregar}
        />
      </StepShell>

      <StepShell n={4} titulo="Pagamento" estado={estado(4)}>
        <StepPayment
          items={items}
          saldo={saldo}
          subtotal={subtotal}
          coupon={coupon}
          couponDiscount={desconto}
          couponMsg={couponMsg}
          onCouponApplied={aplicarCupom}
          onCouponRemoved={removerCupom}
          freteRotulo={freteRotulo}
          freteValor={freteValor}
          total={total}
          temFalta={temFalta}
          canPay={canPay}
          busy={busy}
          saindo={saindo}
          onPay={handlePay}
          error={error}
          errorKind={errorKind}
          reservaPropria={reservaPropria}
          onAjustarSacola={() => useCartUi.getState().openCart()}
          whatsappHref={WHATSAPP_HREF}
        />
      </StepShell>
    </ol>
  );
}
