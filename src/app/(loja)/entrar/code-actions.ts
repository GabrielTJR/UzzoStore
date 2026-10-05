"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { normalizeEmail, onlyDigits } from "@/lib/customer-fields";
import { OTP_DIGITOS, OTP_REENVIO_SEG } from "@/lib/otp-config";
import { siteUrl } from "@/lib/site-url";
import {
  excedeuPorRotulo,
  freiaIp,
  freioEnvioCodigo,
} from "@/lib/rate-limit";

/**
 * Entrar com CÓDIGO de 6 dígitos por e-mail (Supabase OTP) — usado no passo 1
 * do checkout e no "Entrar com código" de /entrar.
 *
 * Por que código e não link: o link abre no navegador do app de e-mail, não no
 * do Instagram onde está a sacola — e o PKCE só fecha no navegador que pediu.
 * O código o cliente digita onde já está.
 *
 * As duas actions usam SEMPRE o client de cookie (`createClient`): é ele que
 * grava o verificador do PKCE no envio e os cookies de sessão na verificação.
 * O client público (sem cookie) ou o admin (service_role) aqui fariam o login
 * acontecer num lugar que o navegador nunca vê.
 */

const MSG_INDISPONIVEL =
  "Não conseguimos enviar o código agora. Tente de novo em instantes, entre com senha ou feche pelo WhatsApp.";
const MSG_EMAIL_INVALIDO = "Digite um e-mail válido.";
/** Mensagem ÚNICA para código errado, vencido ou já usado: mensagens distintas
 * contariam a quem está chutando o que mudar. */
const MSG_CODIGO =
  "Código incorreto ou expirado. Confira os números ou peça um novo código.";

export type SendCodeResult =
  | { ok: true; resendIn: number }
  | { ok: false; error: string; resendIn?: number; codeMayExist?: boolean };

/**
 * Envia o código. A resposta é IGUAL para e-mail novo, existente ou não
 * confirmado — por isso não consulta `email_exists` nem a sessão: a tela não
 * pode virar um jeito de descobrir quem é cliente da loja.
 */
export async function sendLoginCodeAction(
  emailRaw: string,
  origem?: "checkout" | "entrar",
): Promise<SendCodeResult> {
  const email = normalizeEmail(emailRaw);
  if (!email) return { ok: false, error: MSG_EMAIL_INVALIDO };

  const freio = await freioEnvioCodigo(email);
  if (freio === "indisponivel" || freio === "global")
    return { ok: false, error: MSG_INDISPONIVEL };
  if (freio === "ip" || freio === "email")
    return {
      ok: false,
      error: "Muitos pedidos de código. Aguarde alguns minutos e tente de novo.",
    };

  // O destino do link (que segue no e-mail de "Confirm signup") sai de lista
  // FECHADA — nunca de parâmetro do navegador, para não virar open redirect.
  const next = origem === "entrar" ? "%2F" : "%2Fcheckout";

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Conta nasce aqui mesmo: quem compra pela primeira vez não passa
        // por /cadastro.
        shouldCreateUser: true,
        emailRedirectTo: `${siteUrl()}/auth/callback?next=${next}`,
      },
    });
    if (!error) return { ok: true, resendIn: OTP_REENVIO_SEG };

    // O Supabase recusa reenvio antes de 60 s. Quase sempre é o cliente
    // tocando de novo: o código anterior ainda vale, então a tela segue no
    // campo do código em vez de voltar ao e-mail.
    if (
      error.status === 429 ||
      error.code === "over_email_send_rate_limit" ||
      error.code === "over_request_rate_limit"
    )
      return {
        ok: false,
        codeMayExist: true,
        resendIn: OTP_REENVIO_SEG,
        error:
          "Já enviamos um código há pouco. Use o que chegou ou aguarde um minuto para pedir outro.",
      };
    if (
      error.code === "email_address_invalid" ||
      error.code === "validation_failed"
    )
      return { ok: false, error: MSG_EMAIL_INVALIDO };

    // Falha inesperada (SMTP fora, painel mal configurado): registra para o
    // /admin/logs, sem o e-mail no metadata — o rótulo do freio já tem.
    await logAudit(null, {
      action: "auth.otp_send_failed",
      entityType: "auth",
      metadata: { code: error.code ?? null, status: error.status ?? null },
    });
    return { ok: false, error: MSG_INDISPONIVEL };
  } catch {
    await logAudit(null, {
      action: "auth.otp_send_failed",
      entityType: "auth",
      metadata: { code: "exception", status: null },
    });
    return { ok: false, error: MSG_INDISPONIVEL };
  }
}

export type VerifyCodeResult = { ok: true } | { ok: false; error: string };

/**
 * Confere o código e, dando certo, deixa a sessão gravada em cookie nesta
 * mesma resposta. Não redireciona: quem chamou recarrega a página inteira
 * (`window.location.assign`) — assim o "logado" é o mesmo caminho de quem já
 * chega logado, e não um segundo caminho só para depois do código.
 */
export async function verifyLoginCodeAction(
  emailRaw: string,
  codeRaw: string,
): Promise<VerifyCodeResult> {
  const email = normalizeEmail(emailRaw);
  const token = onlyDigits(codeRaw);
  if (!email || token.length !== OTP_DIGITOS)
    return { ok: false, error: MSG_CODIGO };

  // Dois freios: por e-mail (quem chuta o código de UMA pessoa troca de IP,
  // não de alvo) e por IP. O `||` faz o segundo só contar/registrar quando o
  // primeiro deixou passar.
  if (
    (await excedeuPorRotulo("auth.otp_verify", email, 8)) ||
    (await freiaIp("auth.otp_verify", 12, email))
  )
    return {
      ok: false,
      error: "Muitas tentativas. Aguarde alguns minutos e peça um novo código.",
    };

  // Sem `getSessionUser()` antes: ele é memoizado por requisição e guardaria
  // o "anônimo" de antes do login para o resto desta resposta.
  const supabase = await createClient();
  let resultado: Awaited<ReturnType<typeof supabase.auth.verifyOtp>>;
  try {
    // `type: "email"` cobre conta nova e existente; "signup"/"magiclink"
    // estão deprecated no auth-js.
    resultado = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
  } catch {
    return { ok: false, error: "Não foi possível confirmar agora. Tente de novo." };
  }
  const { data, error } = resultado;
  if (error) {
    const status = error.status ?? 0;
    // 4xx = código errado/vencido/usado. O resto (5xx, rede = status 0) é
    // problema nosso ou deles, e dizer "código incorreto" faria o cliente
    // pedir outro código à toa.
    if (status >= 400 && status < 500) return { ok: false, error: MSG_CODIGO };
    return { ok: false, error: "Não foi possível confirmar agora. Tente de novo." };
  }
  if (!data.session || !data.user) return { ok: false, error: MSG_CODIGO };
  const user = data.user;

  // a. A FK de `orders`/`addresses` aponta para `customers`: sem a linha, o
  //    primeiro endereço ou pedido falharia. Erro ignorado — `customer.ts`
  //    também cria na primeira visita à conta.
  await supabase
    .from("customers")
    .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

  // b. Sequestro prévio: alguém pode ter criado conta com ESTE e-mail e uma
  //    senha que só ele sabe, sem nunca confirmar. A confirmação acontece
  //    agora, pelo código do dono da caixa — então a senha do intruso morre
  //    aqui, trocada por uma aleatória que ninguém conhece. Só na PRIMEIRA
  //    confirmação (janela de 2 min): conta antiga mantém a senha do dono.
  const confirmadoEm = Date.parse(user.email_confirmed_at ?? "");
  if (Number.isFinite(confirmadoEm) && Date.now() - confirmadoEm < 120_000) {
    try {
      const { error: pwErr } = await supabase.auth.updateUser({
        password: randomBytes(32).toString("base64url"),
      });
      if (pwErr)
        await logAudit(user, {
          action: "auth.otp_pwreset_failed",
          entityType: "customer",
          entityId: user.id,
          metadata: { code: pwErr.code ?? null, status: pwErr.status ?? null },
        });
    } catch {
      await logAudit(user, {
        action: "auth.otp_pwreset_failed",
        entityType: "customer",
        entityId: user.id,
        metadata: { code: "exception" },
      });
    }
  }

  // c. Só diagnóstico: se o cookie de sessão não foi gravado (webview que
  //    recusa cookie, por exemplo), a página recarrega anônima e o cliente
  //    cai de volta no passo 1. Sem este registro isso seria invisível.
  const temSessao = (await cookies())
    .getAll()
    .some((c) => /-auth-token(\.\d+)?$/.test(c.name));
  if (!temSessao)
    await logAudit(user, {
      action: "auth.otp_cookie_missing",
      entityType: "customer",
      entityId: user.id,
    });

  // d. O código NUNCA vai para o log.
  await logAudit(user, {
    action: "auth.otp_login",
    entityType: "customer",
    entityId: user.id,
  });

  return { ok: true };
}
