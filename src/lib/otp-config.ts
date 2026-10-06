/**
 * Código de acesso por e-mail (Supabase OTP) — módulo NEUTRO: o formulário
 * no navegador e as server actions leem os mesmos números.
 *
 * Tem de bater com o painel do Supabase (Authentication → Providers → Email:
 * "Email OTP Length" e o intervalo mínimo entre envios). Se o painel mudar e
 * isto não, a tela pede 6 dígitos para um código de 8, ou libera o "Reenviar"
 * antes de o Supabase aceitar — e o cliente lê um erro que não entende.
 */

/** Dígitos do código ("Email OTP Length" no painel). O projeto manda 8 —
 * medido em 06/10/2026, quando a tela pedia 6 e o cliente não conseguia entrar. */
export const OTP_DIGITOS = 8;

/** Segundos até liberar o "Reenviar" (o Supabase recusa reenvio antes de 60 s). */
export const OTP_REENVIO_SEG = 60;

/** Minutos que o rascunho "código enviado para X" sobrevive no navegador —
 * cobre a ida e volta ao app de e-mail sem prender a tela num código vencido. */
export const OTP_RASCUNHO_MIN = 15;
