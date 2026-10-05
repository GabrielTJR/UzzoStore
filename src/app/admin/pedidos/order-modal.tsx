"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { IconClose } from "@/components/icons";
import { useModal } from "@/lib/use-modal";
import { abriuPeloCartao, esquecerAbertura } from "./card-link";

/**
 * Casca do MODAL DE PEDIDO — só a moldura: fundo, caixa, cabeçalho, rolagem e
 * o fechar. O conteúdo (`children`) é o detalhe renderizado no servidor.
 *
 * Quem decide se o modal existe é a URL (`?pedido=<número>`), não um estado
 * daqui: o servidor só manda o detalhe do pedido pedido — nunca os cem
 * escondidos no HTML —, o endereço pode ser colado no WhatsApp da equipe, e o
 * "voltar" do navegador fecha sozinho. Por isso fechar é NAVEGAR: de volta
 * para o quadro, quando o pedido foi aberto por um cartão, ou para a mesma
 * tela sem o parâmetro (`closeHref`, montado no servidor), quando o endereço
 * foi aberto direto.
 *
 * No desktop é uma caixa centralizada com rolagem interna; no celular vira
 * folha de tela cheia, que é como se confere um pedido na rua.
 */
export function OrderModal({
  number,
  title,
  subtitle,
  aside,
  closeHref,
  children,
}: {
  /** Número do pedido aberto — é por ele que o modal reencontra o cartão. */
  number: number;
  title: string;
  /** Linha discreta sob o título (o nome do cliente). */
  subtitle?: string;
  /** O que fica à direita do título, antes do fechar (selo de novo, total). */
  aside?: React.ReactNode;
  /** A mesma tela sem `?pedido=` — vem do servidor, que conhece a vista. */
  closeHref: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const titleId = useId();

  // Se este pedido foi aberto por um clique no cartão (ver `card-link.tsx`).
  // Lido uma vez, na montagem: a marca é apagada quando o modal sai da tela,
  // mas a resposta precisa valer enquanto ele estiver aberto.
  const [peloCartao] = useState(() => abriuPeloCartao(number));
  useEffect(() => () => esquecerAbertura(number), [number]);

  // Fechar é uma ida ao servidor (a tela é dinâmica). Dentro de uma transição
  // o `fechando` fica verdadeiro até a navegação terminar, e o modal some no
  // clique em vez de ficar parado na tela esperando a resposta. Se a navegação
  // falhar, a transição acaba e ele reaparece — nada fica em estado falso.
  const [fechando, startTransition] = useTransition();
  // O `router.back()` não passa pela transição (quem navega é o histórico do
  // navegador), então o "sumir no clique" desse caminho tem estado próprio.
  const [voltando, setVoltando] = useState(false);
  const jaVoltou = useRef(false);
  const close = useCallback(() => {
    if (peloCartao) {
      // Aberto pelo cartão: existe uma entrada do quadro logo abaixo desta no
      // histórico, e VOLTAR desfaz a que o clique criou. Trocar o endereço
      // aqui deixaria [quadro, quadro] — um "voltar" morto por pedido
      // conferido. A trava é porque dois Esc seguidos seriam dois "voltar", e
      // o segundo tiraria o admin da tela de pedidos.
      if (jaVoltou.current) return;
      jaVoltou.current = true;
      setVoltando(true);
      router.back();
      return;
    }
    startTransition(() => {
      // Endereço aberto direto (link colado, página recarregada): não há
      // quadro embaixo para onde voltar. `replace`, não `push`, para o fechar
      // não empilhar mais uma entrada; `scroll: false` mantém a tela onde
      // estava.
      router.replace(closeHref, { scroll: false });
    });
  }, [router, closeHref, peloCartao]);

  const oculto = fechando || voltando;
  const ref = useModal<HTMLDivElement>(!oculto, close);

  // O `useModal` só segura o Tab nas duas pontas da caixa. Depois de uma ação,
  // o botão que tinha o foco pode deixar de existir (o pedido mudou de etapa)
  // e o foco cai no `body`; o Tab seguinte iria para o menu ATRÁS do fundo
  // escuro. Qualquer foco que pouse fora da caixa volta para ela.
  useEffect(() => {
    if (oculto) return;
    function onFocusIn(e: FocusEvent) {
      const panel = ref.current;
      if (panel && e.target instanceof Node && !panel.contains(e.target)) {
        panel.focus();
      }
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [oculto, ref]);

  // Devolver o foco ao cartão quando ele MUDOU DE COLUNA. O `useModal` devolve
  // o foco ao elemento que abriu o modal, mas avançar o pedido (o uso
  // principal daqui) tira o cartão de uma coluna e o recria em outra: o link
  // guardado fica fora do documento, o `focus()` dele não faz nada e quem usa
  // teclado voltava ao topo da página. Esta limpeza roda DEPOIS da do
  // `useModal` (mesma ordem em que os efeitos foram declarados), tanto no
  // fechar daqui quanto no "voltar" do navegador: se o foco ficou sem dono,
  // procura o cartão do pedido onde ele estiver agora. Na lista não há cartão,
  // e a busca simplesmente não acha nada.
  useEffect(() => {
    if (oculto) return;
    return () => {
      const ativo = document.activeElement;
      if (ativo && ativo !== document.body) return;
      document
        .querySelector<HTMLElement>(`a[data-pedido="${number}"]`)
        ?.focus();
    };
  }, [oculto, number]);

  if (oculto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-6">
      {/* Clique no fundo fecha. Fora da ordem do Tab: quem usa teclado já tem
          o Esc e os dois botões de fechar. O nome é "fechar os detalhes", não
          "fechar pedido": nesta tela pedido fechado é venda concluída, e o
          modal tem "Concluir pedido" e "Cancelar pedido" logo ao lado. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Fechar detalhes do pedido"
        onClick={close}
        className="absolute inset-0 animate-fade-in cursor-default bg-black/60"
      />

      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full animate-fade-in flex-col bg-background outline-none sm:max-h-[90vh] sm:max-w-3xl sm:rounded-sm sm:border sm:border-border sm:shadow-2xl"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="font-display text-lg font-bold leading-tight"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="truncate text-sm text-muted">{subtitle}</p>
            )}
          </div>
          {aside}
          <button
            type="button"
            onClick={close}
            aria-label="Fechar detalhes do pedido"
            className="-m-2 shrink-0 p-2"
          >
            <IconClose />
          </button>
        </header>

        {/* `relative`: os textos só para leitor de tela do detalhe são
            `position: absolute` e precisam rolar junto com o conteúdo, não
            ficar presos à caixa. */}
        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {children}
        </div>

        {/* O "Fechar" do rodapé não é enfeite: o `useModal` fecha o ciclo do
            Tab no ÚLTIMO controle da caixa, e o último do detalhe pode estar
            dentro de um <details> recolhido (não focável). Com este botão a
            ponta do ciclo é sempre um controle de verdade — e, no celular, é o
            fechar que o polegar alcança. */}
        <footer className="flex shrink-0 justify-end border-t border-border px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={close}
            className="h-10 w-full rounded-xs border border-border px-5 text-sm font-medium hover:border-foreground sm:w-auto"
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}
