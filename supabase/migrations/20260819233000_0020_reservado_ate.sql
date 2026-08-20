-- 0020 — O aviso "em processo de compra" sai da view e vira coluna de estoque.
--
-- A 0019 expunha as reservas por uma view SECURITY DEFINER. Funcionava, mas o
-- linter do Supabase marca isso como ERRO — e com razão: view que atravessa RLS
-- é exatamente o tipo de exceção que alguém "conserta" no futuro sem entender
-- por que existia. Ainda por cima custava uma consulta extra por produto.
--
-- Agora o aviso viaja na PRÓPRIA linha de estoque, que a vitrine já lê no mesmo
-- embed: zero consulta nova, zero exceção de segurança, e nada a explicar para
-- o próximo que passar por aqui.
--
-- `reservado_ate` é dica de EXIBIÇÃO. A verdade da reserva continua em
-- `reservations` — é ela que o pg_cron usa para devolver o saldo.
drop view if exists public.variantes_reservadas;

alter table public.stock_cache
  add column if not exists reservado_ate timestamptz;

comment on column public.stock_cache.reservado_ate is
  'Até quando há compra em curso segurando esta variante. Só para a vitrine dizer "em processo de compra" em vez de "esgotado"; a verdade da reserva está em reservations.';

-- A expiração também limpa a marca: saldo de volta e aviso fora, juntos.
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
       set qty_available = s.qty_available + d.qty,
           reservado_ate = null
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
