-- Papéis de admin + log de auditoria (Etapa 1)

do $$ begin
  create type public.app_role as enum ('owner','admin');
exception when duplicate_object then null;
end $$;

create table if not exists public.admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        public.app_role not null default 'admin',
  must_change_password boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Fonte única da verdade de "é admin?" — usada no código e em RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

alter table public.admins enable row level security;
create policy "admins_read" on public.admins
  for select to authenticated using (public.is_admin());

-- Bootstrap: semeia o admin atual (auth.users) como owner.
insert into public.admins (user_id, full_name, role)
select id, 'Gabriel', 'owner' from auth.users
where email = 'gabrieltoscano@edu.univali.br'
on conflict (user_id) do nothing;

-- Log de auditoria (append-only; escrito pelas server actions via service_role)
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  actor_id     uuid references auth.users(id) on delete set null,
  actor_email  text,
  action       text not null,
  entity_type  text,
  entity_id    text,
  entity_label text,
  metadata     jsonb not null default '{}'::jsonb,
  ip           text,
  user_agent   text
);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);
create index if not exists audit_log_actor_idx   on public.audit_log(actor_id, created_at desc);
create index if not exists audit_log_action_idx  on public.audit_log(action);
create index if not exists audit_log_entity_idx  on public.audit_log(entity_type, entity_id);

-- Sem policy de escrita/leitura p/ anon/authenticated: só service_role grava e lê
-- (leitura no /admin via service_role guardada por getAdminUser).
alter table public.audit_log enable row level security;
