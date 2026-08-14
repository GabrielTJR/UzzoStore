import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Troca o `code` (link de e-mail: confirmação de cadastro, recuperação de
 * senha) por uma sessão e redireciona para `next`.
 *
 * Serve TANTO o admin quanto o cliente da loja, por isso o destino de erro é
 * derivado do próprio `next`: mandar quem tentou recuperar a senha da conta de
 * cliente para `/admin/login` é um beco sem saída — a pessoa não tem login de
 * admin e não entende a tela.
 *
 * Falhar aqui é rotina, não exceção: o link expira, o e-mail é aberto em outro
 * aparelho (o verifier do PKCE fica no navegador que pediu), o clique é duplo,
 * ou um antivírus de e-mail visita o link antes do usuário.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Evita open-redirect: normaliza contra a própria origem e descarta qualquer
  // coisa que escape dela (inclusive `//host` e `/\host`, que o parser de URL
  // resolve como host externo).
  const next = safeNext(searchParams.get("next"), origin);
  const isAdmin = next.startsWith("/admin");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  const falha = isAdmin
    ? "/admin/login?erro=link-invalido"
    : "/entrar?erro=link-invalido";
  return NextResponse.redirect(`${origin}${falha}`);
}

/** Caminho interno seguro; `/` (loja) é o padrão, não `/admin`. */
function safeNext(value: string | null, origin: string): string {
  if (!value) return "/";
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
