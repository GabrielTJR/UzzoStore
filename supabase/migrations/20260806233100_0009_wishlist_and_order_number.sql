-- =====================================================================
-- 0009 — Contas de cliente, parte 2
--   * wishlist: lista de desejos (favoritos) do cliente
--   * orders.number: número curto e legível do pedido (vai na mensagem do
--     WhatsApp e no histórico) — o uuid não serve para o cliente citar
--   * orders.channel: como o pedido foi fechado (whatsapp | online)
-- =====================================================================

create table if not exists public.wishlist (
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id  uuid not null references public.products(id)  on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (customer_id, product_id)
);
create index if not exists wishlist_customer_idx on public.wishlist(customer_id);

-- RLS: cada cliente só enxerga/edita os próprios favoritos.
alter table public.wishlist enable row level security;
create policy "own_wishlist_all" on public.wishlist for all to authenticated
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- Número do pedido (sequência própria, começando num valor "de loja").
create sequence if not exists public.order_number_seq start 1000;
alter table public.orders
  add column if not exists number  bigint not null default nextval('public.order_number_seq'),
  add column if not exists channel text   not null default 'whatsapp';
create unique index if not exists orders_number_uidx on public.orders(number);
