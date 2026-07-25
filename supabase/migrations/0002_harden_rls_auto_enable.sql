-- Hardening (advisor de segurança):
-- A função public.rls_auto_enable() é um EVENT TRIGGER (liga RLS em tabelas novas)
-- e foi sinalizada por ser SECURITY DEFINER exposta via RPC no schema public.
-- Chamá-la via API é um no-op, mas removemos a exposição por segurança.
-- Isso NÃO afeta o event trigger (roda como owner, independente de EXECUTE).
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
