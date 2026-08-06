-- =====================================================================
-- 0007 — Decoração da home editável pelo admin (sem tocar em código).
-- Blocos tipados, ordenáveis e com liga/desliga. O conteúdo de cada tipo
-- vive em `data` (jsonb) para não precisar de migração a cada campo novo:
--   aviso    { text, href? }
--   banner   { slides: [{ imageDesktop, imageMobile?, title?, subtitle?,
--                         buttonLabel?, buttonHref?, align?, theme? }] }
--   mosaico  { title?, cards: [{ image, label, href }] }
--   vitrine  { title?, source: 'destaques'|'promo'|'categoria', categoryId?, limit? }
-- =====================================================================

create table if not exists public.home_sections (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('aviso','banner','mosaico','vitrine')),
  active      boolean not null default true,
  sort_order  integer not null default 0,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists home_sections_order_idx on public.home_sections(sort_order);
create index if not exists home_sections_active_idx on public.home_sections(active);

-- RLS: leitura pública (a vitrine lê com a chave anon); escrita só service_role.
alter table public.home_sections enable row level security;
create policy "catalog_read_home_sections"
  on public.home_sections for select to anon, authenticated using (true);
