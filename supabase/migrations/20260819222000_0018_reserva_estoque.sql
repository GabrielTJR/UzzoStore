-- 0018 — Reserva de estoque enquanto o pagamento está em curso.
--
-- Por quê: o estoque só saía na CONFIRMAÇÃO do pagamento, então dois clientes
-- podiam pagar a mesma última peça. O `decrement_stock` atômico impedia saldo
-- negativo, mas não impedia o segundo pagamento — só registrava `stock.shortage`
-- depois de o dinheiro entrar. Numa loja com 1 peça por cor/tamanho isso não é
-- contratempo: é estornar e pedir desculpa.
--
-- Agora o pedido ONLINE tira a peça do estoque já na criação e grava a linha em
-- `reservations`. Sem pagamento em 20 min, o estoque volta. A `reservations` não
-- é a fonte da verdade do saldo (isso continua no `stock_cache`, que a vitrine
-- já lê e cacheia) — ela existe para saber POR QUE o saldo é zero, e assim a
-- loja poder dizer "última peça em processo de compra" em vez de "esgotado",
-- que seria mentira quando a peça pode voltar em minutos.

-- Devolução do saldo. Espelha o decrement_stock; sem guarda de teto de
-- propósito: devolver é sempre seguro, o que não pode é tirar sem ter.
create or replace function public.increment_stock(p_variant_id uuid, p_qty int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  restante int;
begin
  if p_qty is null or p_qty <= 0 then
    return -1;
  end if;

  update public.stock_cache
  set qty_available = qty_available + p_qty
  where variant_id = p_variant_id
    and deposito_id = 'loja'
  returning qty_available into restante;

  if not found then
    return -1;
  end if;
  return restante;
end;
$$;

revoke all on function public.increment_stock(uuid, int) from public;
revoke all on function public.increment_stock(uuid, int) from anon;
revoke all on function public.increment_stock(uuid, int) from authenticated;
grant execute on function public.increment_stock(uuid, int) to service_role;

-- A reserva pertence ao PEDIDO, não ao carrinho: o carrinho vive no navegador e
-- some sem avisar. `cart_id` fica para o caminho futuro do Microvix.
alter table public.reservations
  add column if not exists order_id uuid
    references public.orders(id) on delete cascade;

create index if not exists reservations_order_idx on public.reservations(order_id);

-- Expiração: devolve o estoque, apaga a reserva e mata o pedido — TUDO JUNTO.
-- Junto importa: devolver o saldo sem matar o pedido deixaria alguém pagar
-- depois, com a peça já de volta na prateleira, que é exatamente o oversell que
-- a reserva veio impedir.
create or replace function public.expira_pedidos_nao_pagos()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  afetados int;
begin
  with vencidos as (
    select id
      from public.orders
     where payment_status = 'pending'
       and channel = 'online'
       and expires_at is not null
       and expires_at < now()
  ),
  -- Agrupa por variante ANTES de somar: um UPDATE só toca cada linha uma vez,
  -- então duas reservas da mesma variante devolveriam apenas uma sem o group by.
  devolucao as (
    select r.variant_id, sum(r.qty)::int as qty
      from public.reservations r
     where r.order_id in (select id from vencidos)
     group by r.variant_id
  ),
  devolve as (
    update public.stock_cache s
       set qty_available = s.qty_available + d.qty
      from devolucao d
     where s.variant_id = d.variant_id
       and s.deposito_id = 'loja'
    returning s.variant_id
  ),
  limpa as (
    delete from public.reservations
     where order_id in (select id from vencidos)
    returning id
  )
  update public.orders
     set payment_status     = 'expired',
         fulfillment_status = 'canceled',
         updated_at         = now()
   where id in (select id from vencidos);

  get diagnostics afetados = row_count;
  return afetados;
end;
$$;

revoke all on function public.expira_pedidos_nao_pagos() from public;
revoke all on function public.expira_pedidos_nao_pagos() from anon;
revoke all on function public.expira_pedidos_nao_pagos() from authenticated;

-- A cada 5 min (era 10): com janela de 20 min, o passo do relógio é o atraso
-- extra em que a peça fica presa sem ninguém pagando por ela.
do $desagenda$
begin
  if exists (select 1 from cron.job where jobname = 'expira-pedidos-nao-pagos')
  then
    perform cron.unschedule('expira-pedidos-nao-pagos');
  end if;
end
$desagenda$;

select cron.schedule(
  'expira-pedidos-nao-pagos',
  '*/5 * * * *',
  $expira$ select public.expira_pedidos_nao_pagos() $expira$
);
