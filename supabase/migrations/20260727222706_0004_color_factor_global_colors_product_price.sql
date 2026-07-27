-- =====================================================================
-- 0004 — Fator "Cor"
--   * colors: cadastro GERAL de cores (dono = site), nome padronizado + swatch
--   * product_colors: cor atribuída a um produto, com galeria de fotos própria
--   * product_variants.product_color_id: variante = grade (cor × tamanho)
--   * products.price/promo_price: preço GLOBAL por produto (edita em 1 lugar)
-- A tabela `prices` (por variante) fica dormante para o futuro Microvix.
-- =====================================================================

-- 1) Cadastro GERAL de cores
create table if not exists public.colors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  hex         text,                       -- swatch "#RRGGBB" (opcional)
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2) Cor atribuída a um produto (galeria por produto×cor)
create table if not exists public.product_colors (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  color_id    uuid not null references public.colors(id)   on delete restrict,
  gallery     jsonb not null default '[]'::jsonb,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (product_id, color_id)
);
create index if not exists product_colors_product_idx on public.product_colors(product_id);
create index if not exists product_colors_color_idx   on public.product_colors(color_id);

-- 3) Variante -> cor-do-produto (grade = cor × tamanho)
alter table public.product_variants
  add column if not exists product_color_id uuid references public.product_colors(id) on delete cascade;
create index if not exists variants_product_color_idx on public.product_variants(product_color_id);

-- Unicidade cor×tamanho por produto (size nulo => peça única por cor)
create unique index if not exists variants_color_size_uidx
  on public.product_variants (product_color_id, coalesce(size, ''))
  where product_color_id is not null;

-- 4) Preço GLOBAL por produto
alter table public.products
  add column if not exists price       numeric(12,2),
  add column if not exists promo_price numeric(12,2);

-- 5) RLS (as tabelas novas ganham RLS pelo event trigger; leitura pública)
alter table public.colors         enable row level security;
alter table public.product_colors enable row level security;
create policy "catalog_read_colors"         on public.colors         for select to anon, authenticated using (true);
create policy "catalog_read_product_colors" on public.product_colors for select to anon, authenticated using (true);

-- =====================================================================
-- BACKFILL
-- =====================================================================

-- 5.1) Preço global := menor preço já cadastrado por produto (hoje já são iguais)
update public.products p
set price       = sub.price,
    promo_price = sub.promo_price
from (
  select v.product_id,
         min(pr.price)       as price,
         min(pr.promo_price) as promo_price
  from public.product_variants v
  join public.prices pr on pr.variant_id = v.id
  group by v.product_id
) sub
where sub.product_id = p.id
  and p.price is null;

-- 5.2) Cor "Padrão" no cadastro geral
insert into public.colors (name, hex, sort_order)
values ('Padrão', null, 0)
on conflict (name) do nothing;

-- 5.3) Cada produto ganha a cor "Padrão", herdando a galeria atual
insert into public.product_colors (product_id, color_id, gallery, sort_order)
select p.id, c.id, coalesce(pc.gallery, '[]'::jsonb), 0
from public.products p
cross join (select id from public.colors where name = 'Padrão') c
left join public.product_content pc on pc.product_id = p.id
where not exists (
  select 1 from public.product_colors x where x.product_id = p.id and x.color_id = c.id
);

-- 5.4) Liga variantes existentes à cor "Padrão" do seu produto
update public.product_variants v
set product_color_id = pc.id,
    color = 'Padrão'
from public.product_colors pc
join public.colors c on c.id = pc.color_id and c.name = 'Padrão'
where pc.product_id = v.product_id
  and v.product_color_id is null;
