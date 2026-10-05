/**
 * Base pública do site, sem barra no fim. Quem precisa de URL ABSOLUTA (link
 * de pagamento da InfinitePay, `emailRedirectTo` do código de acesso) usa
 * esta função — duas cópias divergiriam no dia em que o domínio mudar, e um
 * link de e-mail apontando para o host errado só se descobre em produção.
 *
 * Ordem: `NEXT_PUBLIC_SITE_URL` (configurada na Vercel) → domínio de produção
 * que a Vercel injeta → domínio da loja.
 */
export function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : "https://uzzostore.com.br";
}
