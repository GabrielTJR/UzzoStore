-- 0023 — Configuração da página inicial (editor "Página inicial" do painel).
--
-- Guarda o que o dono edita em /admin/decoracao: o destaque principal (hero),
-- a faixa de avisos e os atalhos de categoria. São DUAS linhas, não duas
-- colunas, de propósito:
--
--   slot = 'publicado' → o que a loja mostra. Leitura PÚBLICA (anon), porque a
--                        home lê com o client sem cookie dentro do
--                        `unstable_cache` (mesmo caminho do resto do catálogo).
--   slot = 'rascunho'  → o que o admin está montando. SEM policy nenhuma: só o
--                        service_role (servidor, depois do `requireAdmin`) lê.
--
-- Com duas colunas na mesma linha, o RLS (que filtra LINHAS) não conseguiria
-- esconder o rascunho de quem pode ler o publicado — seria preciso privilégio
-- por coluna, que é o tipo de detalhe que alguém "conserta" depois sem ver.
--
-- Escrita: nenhuma policy de INSERT/UPDATE/DELETE — só o service_role grava
-- (as actions de `app/admin/home-config-actions.ts`, que conferem o admin).
--
-- `data` é jsonb livre; quem dá forma é `src/lib/home-config.ts`, que
-- normaliza na leitura (nunca confie no formato cru). Sem linha 'publicado', a
-- loja usa os valores de antes do editor (hero de `lib/home-hero.ts`, as
-- mensagens fixas da faixa e as capas automáticas).
--
-- Idempotente: pode rodar de novo sem erro.

create table if not exists public.home_config (
  slot text primary key check (slot in ('rascunho', 'publicado')),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

comment on table public.home_config is
  'Página inicial editável (hero, faixa de avisos, atalhos). Linha "publicado" é pública; "rascunho" só via service_role.';

alter table public.home_config enable row level security;

drop policy if exists "home_config_publicado_leitura" on public.home_config;
create policy "home_config_publicado_leitura"
  on public.home_config
  for select
  to anon, authenticated
  using (slot = 'publicado');
