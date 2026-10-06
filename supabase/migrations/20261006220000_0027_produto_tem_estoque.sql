-- Esgotado no fim da vitrine.
--
-- O catálogo ordena no BANCO (`.order("products(coluna)")`, 1 nível só), então
-- "tem estoque?" precisa ser coluna de `products`. Ela é mantida por gatilho:
-- todo movimento de estoque (venda, reserva, devolução, ajuste no painel, o
-- pg_cron da expiração) passa por `stock_cache`, e o gatilho recalcula o
-- produto daquela variante. Ninguém precisa lembrar de atualizar à mão.
--
-- "Tem estoque" = alguma variante com qty_available > 0. Reserva em curso
-- conta como sem estoque aqui (o saldo saiu); a vitrine mostra "em processo de
-- compra" pelo `reservado_ate`, e quando a reserva expira o saldo volta e o
-- gatilho devolve a peça ao topo.
--
-- Idempotente.

alter table public.products
  add column if not exists tem_estoque boolean not null default false;

create or replace function public.recalcula_tem_estoque(p_product_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.products p
     set tem_estoque = exists (
       select 1
         from public.product_variants v
         join public.stock_cache s on s.variant_id = v.id
        where v.product_id = p_product_id
          and s.qty_available > 0
     )
   where p.id = p_product_id;
$$;

create or replace function public.stock_cache_tem_estoque()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  vid uuid := coalesce(new.variant_id, old.variant_id);
  pid uuid;
begin
  select product_id into pid from public.product_variants where id = vid;
  -- Variante já apagada (cascata): o gatilho de product_variants cuida.
  if pid is not null then
    perform public.recalcula_tem_estoque(pid);
  end if;
  return null;
end;
$$;

drop trigger if exists stock_cache_tem_estoque on public.stock_cache;
create trigger stock_cache_tem_estoque
  after insert or update of qty_available or delete on public.stock_cache
  for each row execute function public.stock_cache_tem_estoque();

create or replace function public.product_variants_tem_estoque()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recalcula_tem_estoque(old.product_id);
  return null;
end;
$$;

drop trigger if exists product_variants_tem_estoque on public.product_variants;
create trigger product_variants_tem_estoque
  after delete on public.product_variants
  for each row execute function public.product_variants_tem_estoque();

-- Funções de gatilho/manutenção: ninguém de fora chama.
revoke all on function public.recalcula_tem_estoque(uuid) from public, anon, authenticated;
revoke all on function public.stock_cache_tem_estoque() from public, anon, authenticated;
revoke all on function public.product_variants_tem_estoque() from public, anon, authenticated;

-- Preenche o que já existe.
update public.products p
   set tem_estoque = exists (
     select 1
       from public.product_variants v
       join public.stock_cache s on s.variant_id = v.id
      where v.product_id = p.id
        and s.qty_available > 0
   );
