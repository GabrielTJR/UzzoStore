import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 16: convenção "proxy" (substitui "middleware"). Runtime nodejs.
export function proxy(request: NextRequest) {
  return updateSession(request);
}

/**
 * O proxy só roda para quem TEM cookie de sessão. Ele existe para renovar a
 * sessão; visitante anônimo não tem o que renovar, e rodá-lo em toda visita
 * era uma invocação paga por página — inclusive nas páginas estáticas, que de
 * resto saem prontas do cache.
 *
 * - `source`: páginas, menos assets, imagens, o webhook (`/api`), sitemap e
 *   robots — nenhum deles usa sessão.
 * - `has`: o cookie `sb-<ref do projeto>-auth-token`, que vem fatiado em `.0`,
 *   `.1`… quando o token é grande (`.0` existe sempre que há fatias). Por isso
 *   duas entradas: cada item da lista é um "ou". O ref é o mesmo fixado no
 *   `next.config.ts` (imagens); se o projeto do Supabase mudar, mude aqui.
 *
 * Tem de ser LITERAL: o Next lê este objeto na compilação, sem executar código.
 */
export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|api/|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      has: [{ type: "cookie", key: "sb-anlbavcstwffnpisacax-auth-token" }],
    },
    {
      source:
        "/((?!_next/static|_next/image|api/|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      has: [{ type: "cookie", key: "sb-anlbavcstwffnpisacax-auth-token.0" }],
    },
  ],
};
