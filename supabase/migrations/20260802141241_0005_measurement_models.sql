-- =====================================================================
-- 0005 — Tabela de medidas (modelos reutilizáveis)
--   * measurement_models: modelo reutilizável (nome + colunas livres +
--     linhas por tamanho com valores + avisos). Dono = site.
--   * products.measurement_model_id: qual modelo o produto usa (opcional).
-- =====================================================================

create table if not exists public.measurement_models (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  columns      jsonb not null default '[]'::jsonb,   -- ["Cintura (cós)","Comprimento","Quadril"]
  rows         jsonb not null default '[]'::jsonb,     -- [{"size":"P","values":["76","53","95"]}]
  note_top     text,                                   -- aviso acima da tabela
  note_bottom  text,                                   -- aviso abaixo da tabela
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.products
  add column if not exists measurement_model_id uuid
    references public.measurement_models(id) on delete set null;
create index if not exists products_measurement_model_idx
  on public.products(measurement_model_id);

-- RLS (tabela nova ganha RLS pelo event trigger); leitura pública.
alter table public.measurement_models enable row level security;
create policy "catalog_read_measurement_models"
  on public.measurement_models for select to anon, authenticated using (true);
