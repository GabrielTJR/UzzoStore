-- Recursos de 07/10/2026: datas das etapas do pedido, lembrete de pagamento,
-- etiqueta do Melhor Envio e avaliações de produto. Idempotente.

-- ---------------------------------------------------------------------------
-- 1. Datas de cada etapa do pedido
-- ---------------------------------------------------------------------------
-- Marcadas por GATILHO na troca de situação: o código que muda a situação
-- (confirmPayment, painel, pg_cron) não precisa lembrar de gravar a data, e
-- nenhum caminho fica sem ela. Só a PRIMEIRA vez conta (coalesce): voltar e
-- avançar de novo não reescreve quando aconteceu.
alter table public.orders
  add column if not exists paid_at timestamptz,
  add column if not exists preparing_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists shipped_at timestamptz,
  add column if not exists done_at timestamptz;

create or replace function public.orders_marca_etapas()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    new.paid_at := coalesce(new.paid_at, now());
  end if;
  if new.fulfillment_status is distinct from old.fulfillment_status then
    case new.fulfillment_status
      when 'preparing' then new.preparing_at := coalesce(new.preparing_at, now());
      when 'ready'     then new.ready_at     := coalesce(new.ready_at, now());
      when 'shipped'   then new.shipped_at   := coalesce(new.shipped_at, now());
      when 'done'      then new.done_at      := coalesce(new.done_at, now());
      else null;
    end case;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_marca_etapas on public.orders;
create trigger orders_marca_etapas
  before update of payment_status, fulfillment_status on public.orders
  for each row execute function public.orders_marca_etapas();

-- ---------------------------------------------------------------------------
-- 2. Lembrete de pagamento não concluído (um e-mail por pedido, no máximo)
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists payment_reminder_sent_at timestamptz;

-- ---------------------------------------------------------------------------
-- 3. Etiqueta do Melhor Envio
-- ---------------------------------------------------------------------------
-- O id do SERVIÇO escolhido (o nome em `shipping_service` muda; o id não) e a
-- etiqueta comprada pelo painel.
alter table public.orders
  add column if not exists shipping_service_id integer,
  add column if not exists melhorenvio_id text,
  add column if not exists label_url text;

-- ---------------------------------------------------------------------------
-- 4. Avaliações de produto
-- ---------------------------------------------------------------------------
-- Só quem COMPROU avalia (o servidor confere um pedido pago e entregue com a
-- peça), uma avaliação por cliente e produto, e nada aparece sem aprovação no
-- painel. Escrita só pelo servidor (service_role); leitura pública só do que
-- foi publicado.
create table if not exists public.product_reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  rating      smallint not null check (rating between 1 and 5),
  body        text check (body is null or char_length(body) <= 1000),
  author_name text,
  status      text not null default 'pending'
              check (status in ('pending', 'published', 'hidden')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (product_id, customer_id)
);

create index if not exists product_reviews_product_idx
  on public.product_reviews (product_id, status);

alter table public.product_reviews enable row level security;

drop policy if exists "reviews_public_read" on public.product_reviews;
create policy "reviews_public_read" on public.product_reviews
  for select to anon, authenticated
  using (status = 'published');
