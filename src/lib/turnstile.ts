import "server-only";
import { headers } from "next/headers";

/**
 * Confere o token do Cloudflare Turnstile (`components/turnstile.tsx`) na API
 * deles. Sem `TURNSTILE_SECRET_KEY` a checagem está DESLIGADA e tudo passa —
 * o site segue funcionando antes de o dono criar as chaves.
 *
 * Falha da Cloudflare (rede, 5xx) também passa: a checagem protege o teto de
 * envios, e travar o login de todo mundo porque a Cloudflare soluçou seria o
 * mesmo estrago que ela existe para evitar. Os freios por IP/e-mail seguem
 * valendo atrás dela.
 */
export async function turnstileValido(
  token: string | null | undefined,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true;
  if (!token || token.length > 2048) return false;

  let ip = "";
  try {
    ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim();
  } catch {
    /* sem cabeçalho: a Cloudflare confere sem IP */
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body, cache: "no-store" },
    );
    if (!res.ok) return true;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return true;
  }
}
