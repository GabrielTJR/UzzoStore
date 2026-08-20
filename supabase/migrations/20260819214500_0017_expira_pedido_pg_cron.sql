-- 0017 — Expiração automática do pedido ONLINE não pago (60 min).
--
-- O relógio roda DENTRO do Postgres de propósito. Um cron na Vercel seria
-- invocação paga disparando sozinha para sempre, e estouro de cota já derrubou
-- esta loja uma vez — o pg_cron não pesa na conta da hospedagem.
--
-- Só o canal online expira: no WhatsApp o pagamento é combinado por fora e pode
-- levar dias, então expirar ali seria cancelar venda boa.
--
-- Expirar mexe nos DOIS eixos: o dinheiro não vem mais (expired) e não há mais
-- o que separar (canceled). Deixar o atendimento em "aguardando" faria o pedido
-- morto continuar aparecendo como trabalho pendente na fila da loja.

create extension if not exists pg_cron;

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
  '*/10 * * * *',
  $expira$
    update public.orders
       set payment_status     = 'expired',
           fulfillment_status = 'canceled',
           updated_at         = now()
     where payment_status = 'pending'
       and channel        = 'online'
       and expires_at is not null
       and expires_at < now()
  $expira$
);
