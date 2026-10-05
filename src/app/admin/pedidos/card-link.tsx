"use client";

import Link from "next/link";
import { OpeningHint } from "./opening-hint";

/**
 * Qual pedido foi aberto por um clique no cartão, nesta aba.
 *
 * O modal precisa saber COMO chegou à tela para fechar direito. Clicar no
 * cartão empilha uma entrada no histórico (quadro → quadro com `?pedido=`);
 * fechar trocando essa entrada pelo endereço do quadro deixaria [quadro,
 * quadro], e depois de conferir cinco pedidos seriam seis "voltar" para sair
 * da tela. Quem veio do cartão fecha VOLTANDO, que desfaz a entrada criada.
 * Quem abriu o endereço direto (link colado no WhatsApp) não tem quadro
 * embaixo para onde voltar, e aí o fechar troca o endereço.
 *
 * Variável de módulo, e não estado: o cartão e o modal não têm ancestral
 * client em comum, e o valor só precisa viver do clique até o modal montar.
 * Recarregar a página zera — e cai no caminho seguro (trocar o endereço).
 */
let abertoPeloCartao: number | null = null;

export function abriuPeloCartao(numero: number): boolean {
  return abertoPeloCartao === numero;
}

/**
 * Chamado quando o modal sai da tela. Sem isso a marca ficaria valendo para
 * uma visita futura ao mesmo pedido por outro caminho, e o "voltar" do fechar
 * levaria o admin para fora da tela de pedidos.
 */
export function esquecerAbertura(numero: number) {
  if (abertoPeloCartao === numero) abertoPeloCartao = null;
}

/**
 * O link do cartão do quadro (o "link esticado" que cobre o cartão inteiro).
 *
 * É client só por causa do `onNavigate`, que não pode ser passado de um Server
 * Component. `onNavigate`, e não `onClick`: ele só dispara na navegação dentro
 * do app — Ctrl+clique (abrir em outra aba) roda o `onClick` sem navegar aqui,
 * e deixaria a marca ligada sem modal nenhum aberto.
 */
export function CardLink({
  numero,
  href,
  className,
  children,
}: {
  numero: number;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      // O quadro fica onde está atrás do modal; e sem prefetch, senão cada
      // cartão à vista viraria uma renderização da tela no servidor.
      scroll={false}
      prefetch={false}
      // É por este atributo que o modal reencontra o cartão ao fechar, quando
      // o pedido mudou de coluna e o link que abriu já não existe.
      data-pedido={numero}
      onNavigate={() => {
        abertoPeloCartao = numero;
      }}
      className={className}
    >
      {children}
      <OpeningHint />
    </Link>
  );
}
