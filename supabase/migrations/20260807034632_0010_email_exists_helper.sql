-- Verifica se um e-mail já tem conta, para o cadastro avisar em vez de mandar
-- o cliente esperar um e-mail que o Supabase não envia (user_repeated_signup).
--
-- SECURITY DEFINER porque auth.users não é acessível pelo dono do schema public.
-- O EXECUTE é REVOGADO de anon/authenticated: só o service_role (nossas server
-- actions) chama. Sem isso, viraria um endpoint público de enumeração de
-- e-mails via RPC — bem pior do que a mensagem na tela.
create or replace function public.email_exists(p_email text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(trim(p_email))
  );
$$;

revoke all on function public.email_exists(text) from public;
revoke all on function public.email_exists(text) from anon;
revoke all on function public.email_exists(text) from authenticated;
grant execute on function public.email_exists(text) to service_role;
