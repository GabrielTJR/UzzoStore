"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { normalizeEmail, onlyDigits } from "@/lib/customer-fields";
import {
  OTP_DIGITOS,
  OTP_RASCUNHO_MIN,
  OTP_REENVIO_SEG,
} from "@/lib/otp-config";
import {
  sendLoginCodeAction,
  verifyLoginCodeAction,
} from "@/app/(loja)/entrar/code-actions";

/**
 * Entrar com CÓDIGO por e-mail — passo 1 do checkout e "Entrar com código" de
 * /entrar. Quem decide o destino depois do login é o chamador (`onVerified`),
 * e o combinado é sempre RECARGA COMPLETA: o pós-login passa a ser o mesmo
 * caminho de "cliente logado abre a página", que dá para testar com senha.
 *
 * Decisões que vieram do celular e não podem regredir:
 * - O campo do código recebe foco DENTRO do toque em "Receber código"
 *   (`flushSync` + `focus()` antes do `await`). No iOS, foco dado depois de um
 *   `await` não abre o teclado, e o cliente fica olhando caixas vazias.
 * - Rascunho em localStorage: o cliente sai para o app de e-mail e volta (às
 *   vezes com a aba recarregada, no navegador do Instagram). Sem o rascunho,
 *   ele voltaria ao campo de e-mail e pediria outro código, invalidando o que
 *   acabou de ler.
 * - Campos com 16 px no celular: abaixo disso o iOS dá zoom na página ao focar.
 */

const RASCUNHO = "uzzo-otp";
const FLAG_OK = "uzzo-otp-ok";

type Rascunho = { email: string; sentAt: number; resendIn: number };

function lerRascunho(): Rascunho | null {
  try {
    const raw = localStorage.getItem(RASCUNHO);
    if (!raw) return null;
    const r = JSON.parse(raw) as Partial<Rascunho>;
    if (
      typeof r.email !== "string" ||
      typeof r.sentAt !== "number" ||
      typeof r.resendIn !== "number"
    )
      return null;
    // Rascunho velho prenderia a tela num código que já venceu.
    if (Date.now() - r.sentAt > OTP_RASCUNHO_MIN * 60_000) return null;
    return { email: r.email, sentAt: r.sentAt, resendIn: r.resendIn };
  } catch {
    return null;
  }
}

function gravarRascunho(r: Rascunho) {
  try {
    localStorage.setItem(RASCUNHO, JSON.stringify(r));
  } catch {
    /* navegação privada: segue sem rascunho */
  }
}

function apagarRascunho() {
  try {
    localStorage.removeItem(RASCUNHO);
  } catch {
    /* idem */
  }
}

const campo =
  "h-12 w-full rounded-xs border border-border bg-transparent px-4 text-base outline-none transition-colors focus:border-foreground aria-[invalid=true]:border-red-600 sm:text-sm";
const primario =
  "inline-flex h-12 w-full items-center justify-center rounded-xs bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50";
const linkTexto =
  "underline underline-offset-4 hover:text-foreground disabled:no-underline disabled:opacity-60";

type Fase = "email" | "codigo" | "entrando";

export function EmailCodeForm({
  origem,
  onVerified,
  senhaHref = null,
}: {
  origem: "checkout" | "entrar";
  onVerified: () => void;
  senhaHref?: string | null;
}) {
  const uid = useId();
  const emailId = `${uid}-email`;
  const codeId = `${uid}-codigo`;
  const erroId = `${uid}-erro`;
  const dicaCodigoId = `${uid}-dica`;

  const [fase, setFase] = useState<Fase>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Aviso que não é erro ("já enviamos um código há pouco"). */
  const [aviso, setAviso] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [resendIn, setResendIn] = useState(OTP_REENVIO_SEG);
  const [now, setNow] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  /** Último código enviado sozinho: o mesmo valor não é conferido duas vezes
   * (colar dispara `onPaste` e às vezes `onChange` em seguida). */
  const ultimoTentado = useRef<string | null>(null);

  // Ao montar (este formulário só aparece para quem NÃO está logado):
  // 1. Detector de laço — se acabamos de confirmar um código e mesmo assim a
  //    página voltou anônima, o navegador não guardou o cookie de sessão
  //    (webview restrito). Pedir outro código daria no mesmo; o caminho é
  //    senha ou WhatsApp.
  // 2. Rascunho válido reabre direto no campo do código.
  // Leitura de armazenamento do navegador = sincronizar com sistema externo,
  // por isso no efeito (e não no render, que também roda no servidor).
  /* eslint-disable react-hooks/set-state-in-effect -- o estado vem do
     armazenamento do navegador, que só existe depois de montar */
  useEffect(() => {
    let laco = false;
    try {
      const ok = Number(sessionStorage.getItem(FLAG_OK));
      if (ok && Date.now() - ok < 60_000) {
        sessionStorage.removeItem(FLAG_OK);
        laco = true;
      }
    } catch {
      /* sem sessionStorage: sem detector */
    }
    if (laco) {
      apagarRascunho();
      setError(
        "Não conseguimos manter você conectado neste navegador. Entre com senha ou feche pelo WhatsApp.",
      );
      return;
    }
    const r = lerRascunho();
    if (r) {
      setEmail(r.email);
      setSentAt(r.sentAt);
      setResendIn(r.resendIn);
      setNow(Date.now());
      setFase("codigo");
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Contagem do "Reenviar em 0:SS". Derivada de `sentAt + resendIn` (não de um
  // contador que desce): o navegador congela timers de aba em segundo plano,
  // e quem volta do app de e-mail veria um número parado. Por isso também o
  // `visibilitychange`.
  const restante =
    sentAt == null
      ? 0
      : Math.max(0, Math.ceil((sentAt + resendIn * 1000 - now) / 1000));

  useEffect(() => {
    if (fase !== "codigo" || restante <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [fase, restante]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  async function enviar(alvo: string) {
    setSending(true);
    try {
      const res = await sendLoginCodeAction(alvo, origem);
      const t = Date.now();
      if (res.ok) {
        setSentAt(t);
        setNow(t);
        setResendIn(res.resendIn);
        gravarRascunho({ email: alvo, sentAt: t, resendIn: res.resendIn });
      } else if (res.codeMayExist) {
        // O Supabase recusou por envio recente: o código anterior ainda vale,
        // então a tela fica no campo do código, só avisando.
        const espera = res.resendIn ?? OTP_REENVIO_SEG;
        setSentAt(t);
        setNow(t);
        setResendIn(espera);
        setAviso(res.error);
        gravarRascunho({ email: alvo, sentAt: t, resendIn: espera });
      } else {
        apagarRascunho();
        setFase("email");
        setError(res.error);
      }
    } catch {
      apagarRascunho();
      setFase("email");
      setError("Não conseguimos enviar o código agora. Tente de novo.");
    } finally {
      setSending(false);
    }
  }

  function handleEmailSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const alvo = normalizeEmail(email);
    if (!alvo) {
      setError("Digite um e-mail válido.");
      emailRef.current?.focus();
      return;
    }
    // Otimista: a tela já vai para o código e o foco entra no campo AINDA
    // dentro do toque — é o que faz o teclado numérico abrir no iOS.
    const t = Date.now();
    flushSync(() => {
      setEmail(alvo);
      setError(null);
      setAviso(null);
      setCode("");
      setSentAt(t);
      setNow(t);
      setResendIn(OTP_REENVIO_SEG);
      setFase("codigo");
    });
    ultimoTentado.current = null;
    codeRef.current?.focus();
    void enviar(alvo);
  }

  function handleReenviar() {
    if (sending || restante > 0) return;
    setError(null);
    setAviso(null);
    setCode("");
    ultimoTentado.current = null;
    codeRef.current?.focus();
    void enviar(email);
  }

  function handleTrocarEmail() {
    apagarRascunho();
    flushSync(() => {
      setFase("email");
      setCode("");
      setError(null);
      setAviso(null);
      setSentAt(null);
    });
    emailRef.current?.focus();
  }

  async function verificar(valor: string) {
    if (verifying) return;
    ultimoTentado.current = valor;
    setVerifying(true);
    setError(null);
    try {
      const res = await verifyLoginCodeAction(email, valor);
      if (res.ok) {
        // Marca para o detector de laço (ver efeito de montagem) e sai.
        try {
          sessionStorage.setItem(FLAG_OK, String(Date.now()));
        } catch {
          /* sem sessionStorage: só perde o detector */
        }
        apagarRascunho();
        setFase("entrando");
        onVerified();
        return;
      }
      setError(res.error);
    } catch {
      setError("Não foi possível confirmar agora. Tente de novo.");
    }
    // Erro: campo limpo e foco de volta, para digitar de novo sem tocar em nada.
    setCode("");
    ultimoTentado.current = null;
    setVerifying(false);
    codeRef.current?.focus();
  }

  function atualizarCodigo(valor: string) {
    const digitos = onlyDigits(valor).slice(0, OTP_DIGITOS);
    setCode(digitos);
    if (error) setError(null);
    // Envio automático ao completar — o botão "Confirmar código" é a reserva.
    if (digitos.length === OTP_DIGITOS && ultimoTentado.current !== digitos)
      void verificar(digitos);
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    // O código costuma vir colado com espaço ou hífen ("482 913"); com o
    // `maxLength` o navegador cortaria antes de limparmos.
    const texto = e.clipboardData.getData("text").replace(/[\s-]/g, "");
    const achado = texto.match(new RegExp(`\\d{${OTP_DIGITOS}}`));
    if (!achado) return;
    e.preventDefault();
    atualizarCodigo(achado[0]);
  }

  function handleCodeSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (code.length !== OTP_DIGITOS) {
      setError(`Digite os ${OTP_DIGITOS} números do código.`);
      codeRef.current?.focus();
      return;
    }
    void verificar(code);
  }

  if (fase === "entrando")
    return (
      <p role="status" className="text-sm text-muted">
        Entrando…
      </p>
    );

  const erroBox = error ? (
    <p
      id={erroId}
      role="alert"
      className="text-sm text-red-600 dark:text-red-400"
    >
      {error}
    </p>
  ) : null;

  if (fase === "email")
    return (
      <form onSubmit={handleEmailSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={emailId} className="block text-sm font-medium">
            E-mail
          </label>
          <input
            ref={emailRef}
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? erroId : undefined}
            className={campo}
          />
          <p className="text-sm text-muted">
            Vamos enviar um código de {OTP_DIGITOS} dígitos para o seu e-mail. Sem
            senha.
          </p>
        </div>
        {erroBox}
        <button type="submit" disabled={sending} className={primario}>
          Receber código
        </button>
        {senhaHref && (
          <p className="text-center text-sm text-muted">
            Já tem senha?{" "}
            <Link href={senhaHref} prefetch={false} className={linkTexto}>
              Entrar com senha
            </Link>
          </p>
        )}
      </form>
    );

  const minutos = Math.floor(restante / 60);
  const segundos = String(restante % 60).padStart(2, "0");

  return (
    <form onSubmit={handleCodeSubmit} noValidate className="space-y-4">
      <p className="text-sm text-muted">
        Enviamos o código para{" "}
        <span className="break-all font-medium text-foreground">{email}</span>
        .{" "}
        <button
          type="button"
          onClick={handleTrocarEmail}
          className={`${linkTexto} inline-flex min-h-11 items-center align-middle`}
        >
          Trocar e-mail
        </button>
      </p>

      <div className="space-y-2">
        <label htmlFor={codeId} className="block text-sm font-medium">
          Código que enviamos para o seu e-mail
        </label>
        {/* UM input só (o autocompletar do código no iOS/Android e o colar
            dependem disso), desenhado como uma casa por dígito (8, com folga no celular): o input fica por cima,
            transparente, e as casas abaixo só mostram os dígitos. */}
        <div className="relative">
          <div aria-hidden className="flex gap-1.5 sm:gap-2">
            {Array.from({ length: OTP_DIGITOS }).map((_, i) => {
              const atual =
                codeFocused &&
                (i === code.length ||
                  (code.length === OTP_DIGITOS && i === OTP_DIGITOS - 1));
              return (
                <span
                  key={i}
                  className={`flex h-14 min-w-0 flex-1 items-center justify-center rounded-xs border text-xl font-medium tabular-nums sm:text-2xl ${
                    atual
                      ? "border-accent ring-1 ring-accent"
                      : error
                        ? "border-red-600"
                        : code[i]
                          ? "border-foreground"
                          : "border-border"
                  }`}
                >
                  {code[i] ?? ""}
                </span>
              );
            })}
          </div>
          <input
            ref={codeRef}
            id={codeId}
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={OTP_DIGITOS}
            enterKeyHint="done"
            value={code}
            readOnly={verifying}
            onChange={(e) => atualizarCodigo(e.target.value)}
            onPaste={handlePaste}
            onFocus={() => setCodeFocused(true)}
            onBlur={() => setCodeFocused(false)}
            aria-invalid={!!error || undefined}
            aria-describedby={
              error ? `${erroId} ${dicaCodigoId}` : dicaCodigoId
            }
            className="absolute inset-0 h-full w-full bg-transparent text-base text-transparent caret-transparent outline-none selection:bg-transparent"
          />
        </div>
      </div>

      {erroBox}
      {aviso && !error && (
        <p role="status" className="text-sm text-muted">
          {aviso}
        </p>
      )}
      {verifying && (
        <p role="status" className="text-sm text-muted">
          Conferindo o código…
        </p>
      )}

      <div id={dicaCodigoId} className="space-y-1 text-sm text-muted">
        <p>
          Não chegou?{" "}
          {restante > 0 ? (
            <span className="tabular-nums">
              Reenviar em {minutos}:{segundos}
            </span>
          ) : (
            <button
              type="button"
              onClick={handleReenviar}
              disabled={sending}
              className={`${linkTexto} inline-flex min-h-11 items-center align-middle text-foreground`}
            >
              {sending ? "Enviando…" : "Reenviar código"}
            </button>
          )}
        </p>
        <p>
          Olhe o spam e a aba Promoções. Vale sempre o código mais recente.
        </p>
      </div>

      <button
        type="submit"
        disabled={verifying || code.length !== OTP_DIGITOS}
        className={primario}
      >
        {verifying ? "Conferindo…" : "Confirmar código"}
      </button>
    </form>
  );
}
