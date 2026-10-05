import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

/**
 * Freios das server actions públicas, contados no próprio `audit_log` (que já
 * grava o IP de cada evento) — sem tabela nova nem serviço externo.
 *
 * Server Action é endpoint público: qualquer um chama em laço, sem passar pela
 * tela. Cada ação aqui custa algo de verdade (chamada ao Melhor Envio, e-mail
 * na cota do Resend, consulta a cupom), então o freio é o que impede um script
 * de transformar isso em conta para a loja pagar.
 *
 * Regra geral: falha ABERTO. Barrar cliente real por um problema no log é pior
 * do que o abuso que o freio evita. A exceção é o envio de código, que falha
 * FECHADO sem a service key (ver `freioEnvioCodigo`).
 */

const JANELA_MIN = 10;

/** IP do visitante como a Vercel repassa — o MESMO que `logAudit` grava, senão
 * a contagem nunca acharia os registros que ela mesma fez. */
async function ipDaRequisicao(): Promise<string | null> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;
}

function desde(minutos: number): string {
  return new Date(Date.now() - minutos * 60_000).toISOString();
}

/**
 * Freio por IP: `true` = bloqueia. Janela de 10 min.
 *
 * Só REGISTRA enquanto está abaixo do teto: acima dele a recusa custa um COUNT
 * e o log não infla com o próprio abuso. `rotulo` vai para `entity_label` — é
 * o que `excedeuPorRotulo` conta (ex.: o e-mail na verificação de código).
 *
 * Sem IP (local), sem service key ou com erro: deixa passar.
 */
export async function freiaIp(
  action: string,
  limite: number,
  rotulo?: string | null,
): Promise<boolean> {
  try {
    const ip = await ipDaRequisicao();
    if (!ip) return false;
    // Dentro do try: sem a service key o construtor lança, e isso não pode
    // derrubar a action que só queria saber se pode seguir.
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("action", action)
      .eq("ip", ip)
      .gte("created_at", desde(JANELA_MIN));
    if (error) return false;
    if ((count ?? 0) >= limite) return true;
    await logAudit(null, {
      action,
      entityType: "rate",
      entityLabel: rotulo ?? null,
    });
    return false;
  } catch {
    return false;
  }
}

/**
 * Freio por RÓTULO (ex.: o e-mail), independente do IP: quem tenta adivinhar
 * o código de uma pessoa troca de IP à vontade, mas não troca o e-mail alvo.
 * Só CONTA — quem registra é o `freiaIp` chamado em seguida com o mesmo rótulo.
 * Falha aberto.
 */
export async function excedeuPorRotulo(
  action: string,
  rotulo: string,
  limite: number,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("action", action)
      .eq("entity_label", rotulo)
      .gte("created_at", desde(JANELA_MIN));
    if (error) return false;
    return (count ?? 0) >= limite;
  } catch {
    return false;
  }
}

/** Tetos do envio de código. O teto GLOBAL precisa ficar abaixo do limite de
 * e-mails por hora do painel do Supabase: quem bate primeiro tem de ser o nosso,
 * que responde com mensagem clara, e não o deles. */
const OTP_TETO_GLOBAL_HORA = 60;
const OTP_TETO_EMAIL_10MIN = 4;
const OTP_TETO_IP_10MIN = 8;

/**
 * Freio do "Receber código". Cada envio é um e-mail na MESMA cota do Resend que
 * leva os avisos de pedido pago — se um laço esgota a cota, a loja para de ser
 * avisada das vendas em silêncio. Por isso três tetos (por e-mail, por IP e
 * global por hora) numa consulta só.
 *
 * Diferente dos outros freios, falha FECHADO sem a service key: sem ela não há
 * como contar, e um envio sem freio é exatamente o risco acima. Erro de LEITURA
 * (banco piscou) segue aberto — aí o problema é passageiro e o teto do painel
 * do Supabase continua valendo.
 *
 * Abaixo dos tetos, registra `auth.otp_send` com o e-mail no rótulo (como
 * `email.sent` já faz) — é o que a próxima chamada conta.
 */
export async function freioEnvioCodigo(
  email: string,
): Promise<"ok" | "ip" | "email" | "global" | "indisponivel"> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return "indisponivel";
  try {
    const admin = createAdminClient();
    const ip = await ipDaRequisicao();
    const { data, error } = await admin
      .from("audit_log")
      .select("ip, entity_label, created_at")
      .eq("action", "auth.otp_send")
      .gte("created_at", desde(60))
      .order("created_at", { ascending: false })
      .limit(500);
    if (error || !data) return "ok";

    const corte = Date.parse(desde(JANELA_MIN));
    const recentes = data.filter((r) => Date.parse(r.created_at) >= corte);
    if (recentes.filter((r) => r.entity_label === email).length >= OTP_TETO_EMAIL_10MIN)
      return "email";
    if (ip && recentes.filter((r) => r.ip === ip).length >= OTP_TETO_IP_10MIN)
      return "ip";
    if (data.length >= OTP_TETO_GLOBAL_HORA) return "global";

    await logAudit(null, {
      action: "auth.otp_send",
      entityType: "rate",
      entityLabel: email,
    });
    return "ok";
  } catch {
    return "ok";
  }
}
