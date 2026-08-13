-- Colunas para ORDENAR a vitrine no banco (a ordenação precisa ser no banco,
-- senão quebra entre páginas).
--
-- 1) effective_price: ordenar por `price` mostraria a peça em promoção na
--    posição do preço cheio. Coluna gerada = sempre coerente com o que a
--    vitrine exibe (promo ?? cheio).
alter table public.products
  add column if not exists effective_price numeric(12,2)
  generated always as (
    case when promo_price is not null and promo_price > 0
         then promo_price else price end
  ) stored;

-- 2) category_name desnormalizado: o PostgREST não ordena por embed de dois
--    níveis (products -> categories), então guardamos o nome no produto e
--    mantemos em dia por trigger.
alter table public.products add column if not exists category_name text;

update public.products p
set category_name = c.name
from public.categories c
where c.id = p.category_id and p.category_name is distinct from c.name;

create or replace function public.sync_product_category_name()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.category_name := (
    select c.name from public.categories c where c.id = new.category_id
  );
  return new;
end;
$$;

drop trigger if exists products_category_name on public.products;
create trigger products_category_name
  before insert or update of category_id on public.products
  for each row execute function public.sync_product_category_name();

-- Renomear a categoria precisa repercutir nos produtos dela.
create or replace function public.sync_category_name_to_products()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.name is distinct from old.name then
    update public.products set category_name = new.name where category_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists categories_name_to_products on public.categories;
create trigger categories_name_to_products
  after update of name on public.categories
  for each row execute function public.sync_category_name_to_products();

create index if not exists products_category_name_idx on public.products(category_name);
create index if not exists products_effective_price_idx on public.products(effective_price);
