"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";

/**
 * Aviso de cookies — e o portão do Google Analytics.
 *
 * Este componente NÃO é um aviso decorativo: ele decide se o gtag.js carrega.
 * Enquanto o cliente não aceitar, **nenhum script do Google entra na página** e
 * nenhum cookie `_ga` é gravado. Aviso que diz "usamos cookies" enquanto o
 * rastreador já rodou desde o primeiro milissegundo é pior que não ter aviso:
 * dá a aparência de uma escolha que não existe.
 *
 * O Guia Orientativo de Cookies da ANPD trata cookie de medição como
 * dispensável de "necessário" — ou seja, pede consentimento, e recusar tem de
 * ser tão fácil quanto aceitar. Por isso os dois botões têm o mesmo peso
 * visual; não existe "Aceitar" grande e verde com um "preferências" cinza
 * escondido embaixo.
 *
 * O que NÃO passa por aqui, de propósito:
 *   - cookie de sessão do Supabase (é o que mantém o cliente logado; sem ele
 *     não há como entregar o serviço pedido);
 *   - a sacola, que vive em localStorage e não é cookie nem sai do aparelho;
 *   - o Analytics da Vercel, que por desenho não grava cookie nenhum.
 *
 * Custo: zero. É leitura de localStorage, sem rede, sem banco, sem consulta —
 * e o banner só existe em memória até o cliente decidir.
 */

const CHAVE = "uzzo-cookies";

type Escolha = "aceito" | "recusado";

/**
 * Apaga os cookies que o Google já tenha gravado (`_ga`, `_ga_<ID>`).
 *
 * Deixar de carregar o script NÃO desfaz o que ele já escreveu: quem aceitou
 * ontem e recusa hoje continuaria marcado no navegador. Revogação que não apaga
 * nada é revogação de fachada.
 *
 * Cookie só some se o apagar usar o MESMO domínio e caminho com que foi
 * gravado, e o GA grava no domínio pai (`.uzzostore.com.br`) — por isso subimos
 * um nível de cada vez a partir do host atual. As tentativas que o navegador
 * recusa (domínio público como `.com.br`) falham em silêncio, sem efeito.
 */
function limparCookiesGa() {
  const nomes = document.cookie
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter((n) => n.startsWith("_ga"));
  if (nomes.length === 0) return;

  const partes = location.hostname.split(".");
  const dominios: (string | undefined)[] = [undefined];
  for (let i = 0; i < partes.length - 1; i++) {
    dominios.push(`.${partes.slice(i).join(".")}`);
  }

  for (const nome of nomes) {
    for (const dominio of dominios) {
      document.cookie =
        `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/` +
        (dominio ? `; domain=${dominio}` : "");
    }
  }
}

/**
 * Botão da página de privacidade para REVER a escolha.
 *
 * Consentimento que não dá para voltar atrás não é consentimento — a LGPD
 * garante a revogação a qualquer momento. Apagar a chave faz o banner
 * reaparecer; o `location.reload()` é o que efetivamente derruba o gtag.js já
 * carregado, porque script injetado não some só por deixar de ser renderizado.
 */
export function CookieResetButton() {
  const [feito, setFeito] = useState(false);

  function limpar() {
    limparCookiesGa();
    try {
      localStorage.removeItem(CHAVE);
    } catch {
      // storage bloqueado: não havia o que apagar
    }
    setFeito(true);
    location.reload();
  }

  return (
    <button
      type="button"
      onClick={limpar}
      disabled={feito}
      className="rounded-full border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-foreground/5 disabled:opacity-60"
    >
      Rever minha escolha de cookies
    </button>
  );
}

export function CookieConsent({ gaId }: { gaId: string }) {
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  /**
   * Nada é renderizado no servidor nem no primeiro render do cliente: a decisão
   * mora no localStorage, que só existe no navegador. Sem esta trava, o HTML do
   * servidor (sem banner) brigaria com o do cliente (com banner) e o React
   * acusaria erro de hidratação.
   */
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
    try {
      const salvo = localStorage.getItem(CHAVE);
      if (salvo === "aceito" || salvo === "recusado") setEscolha(salvo);
    } catch {
      // Janela anônima ou armazenamento bloqueado: segue como "ainda não
      // decidiu". O banner reaparece, e é o comportamento certo — sem poder
      // guardar a resposta, presumir aceite seria inventar um consentimento.
    }
  }, []);

  function decidir(valor: Escolha) {
    setEscolha(valor);
    // Recusar apaga o que um aceite anterior tenha deixado para trás.
    if (valor === "recusado") limparCookiesGa();
    try {
      localStorage.setItem(CHAVE, valor);
    } catch {
      // Não deu para guardar: a escolha vale para esta navegação mesmo assim.
    }
  }

  if (!montado) return null;

  return (
    <>
      {escolha === "aceito" && (
        <>
          {/* Só chega aqui depois do "Aceitar". Ver o comentário do topo:
              é este condicional que faz o aviso valer alguma coisa. */}
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}');
            `}
          </Script>
        </>
      )}

      {escolha === null && (
        <div
          // z-50 é a camada da gaveta da sacola. O banner fica em z-40 para
          // nunca cobrir a sacola aberta — ali o cliente está comprando.
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur"
          role="region"
          aria-label="Aviso de cookies"
        >
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:gap-6">
            {/* Texto curto de propósito: no celular o banner cobre a primeira
                dobra, e isso é atrito na visita inicial. O que não pode sair é
                a distinção entre o cookie necessário e o de medição — é ela que
                dá sentido aos dois botões. */}
            <p className="text-sm leading-relaxed text-muted">
              Usamos cookies para entender como a loja é usada. Os que mantêm
              você logado e guardam a sacola são necessários; os de medição só
              entram se você deixar.{" "}
              <Link
                href="/privacidade"
                className="whitespace-nowrap text-foreground underline underline-offset-4"
              >
                Saiba mais
              </Link>
            </p>
            {/* Os dois botões com o mesmo peso: recusar tem de ser tão fácil
                quanto aceitar. `shrink-0` para não espremerem no celular. */}
            <div className="flex shrink-0 gap-3">
              <button
                type="button"
                onClick={() => decidir("recusado")}
                className="flex-1 rounded-full border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-foreground/5 sm:flex-none"
              >
                Recusar
              </button>
              <button
                type="button"
                onClick={() => decidir("aceito")}
                className="flex-1 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 sm:flex-none"
              >
                Aceitar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
