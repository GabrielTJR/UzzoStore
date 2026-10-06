-- A lista da equipe (nomes e cargos) deixa de ser legível pelo VENDEDOR.
--
-- A policy `admins_read` (migração 0003) usava `is_admin()`, que é verdade
-- para todo mundo da equipe — então o vendedor, que no painel não vê a tela
-- Equipe, conseguia ler a tabela inteira chamando a API direto com a sessão
-- dele. Agora: cada um lê a PRÓPRIA linha (é o que o site usa para saber o
-- cargo de quem está logado) e só Dono/Administrador leem as dos outros.
--
-- A tela Equipe e as ações da equipe usam service_role e não dependem disto.
-- Idempotente.

-- Cargo de quem chama, sem passar pela RLS da própria tabela (uma policy que
-- consultasse `admins` dentro de `admins` entraria em recursão).
create or replace function public.admin_cargo()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role::text from public.admins where user_id = auth.uid();
$$;
revoke all on function public.admin_cargo() from public, anon;
grant execute on function public.admin_cargo() to authenticated;

drop policy if exists "admins_read" on public.admins;
create policy "admins_read" on public.admins
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.admin_cargo() in ('owner', 'admin')
  );
