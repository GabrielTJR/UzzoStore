-- 0016 — Pedido em DOIS EIXOS: pagamento e atendimento.
--
-- Por quê: `orders.status` misturava as duas coisas numa trilha linear única, e
-- o admin avançava tudo pelo mesmo botão. O resultado apareceu em produção: os
-- pedidos nº 1007 e 1008 ficaram com status "pago" e payment_status "pending"
-- ao mesmo tempo — alguém clicou em avançar sem dinheiro nenhum ter entrado.
-- Separar os eixos é o que os sistemas maduros fazem (no Shopify, payment
-- status e fulfillment status são independentes) e mata a contradição por
-- construção, não por disciplina de quem clica.
--
--   pagamento    pending -> paid | expired | refunded | canceled
--                ONLINE   -> só o confirmPayment escreve (payment_check + valor)
--                WHATSAPP -> manual, porque o dinheiro entra fora do sistema
--   atendimento  pending -> preparing -> ready (retirada) | shipped (entrega) -> done
--                sempre manual, e TRAVADO enquanto o pagamento não for 'paid'

-- 1) Pagamento: vocabulário único ('approved' vira 'paid') e domínio fechado.
update public.orders set payment_status = 'paid'    where payment_status = 'approved';
update public.orders set payment_status = 'pending' where payment_status is null;

alter table public.orders
  alter column payment_status set default 'pending';
alter table public.orders
  alter column payment_status set not null;

alter table public.orders drop constraint if exists orders_payment_status_chk;
alter table public.orders add constraint orders_payment_status_chk
  check (payment_status in ('pending','paid','expired','refunded','canceled'));

-- 2) Atendimento: coluna própria, herdando o que o `status` antigo dizia.
alter table public.orders
  add column if not exists fulfillment_status text not null default 'pending';

update public.orders set fulfillment_status = case status
  when 'ready'     then 'ready'
  when 'shipped'   then 'shipped'
  when 'delivered' then 'done'
  when 'canceled'  then 'canceled'
  else 'pending'   -- 'pending' e 'paid' antigos são ambos "ainda não separado"
end;

alter table public.orders drop constraint if exists orders_fulfillment_status_chk;
alter table public.orders add constraint orders_fulfillment_status_chk
  check (fulfillment_status in ('pending','preparing','ready','shipped','done','canceled'));

-- O `status` antigo sai. Manter os dois seria deixar a porta da contradição
-- aberta — e o texto livre foi justamente o que permitiu o estado impossível.
alter table public.orders drop column if exists status;

-- 3) Expiração do não-pago. Só no online: no WhatsApp o pagamento é combinado
-- por fora e pode levar dias, então expirar seria cancelar venda boa.
alter table public.orders add column if not exists expires_at timestamptz;

create index if not exists orders_expira_idx
  on public.orders (expires_at)
  where payment_status = 'pending';

comment on column public.orders.expires_at is
  'Quando o pedido online não pago deixa de valer (60 min). Nulo no WhatsApp.';
