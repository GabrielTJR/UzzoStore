-- =====================================================================
-- Uzzo Store — Esquema inicial (Fase 0)
-- =====================================================================
-- Convenção (ver docs/ARQUITETURA.md):
--   * Tabelas ESPELHO  -> fonte de verdade = Linx Microvix. Escritas SOMENTE
--     pelo worker de sync (service_role). O site apenas LÊ.
--   * Tabelas PRÓPRIAS -> fonte de verdade = este site (Supabase).
-- RLS habilitado em TODAS as tabelas. service_role ignora RLS (uso server-side).
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. TABELAS ESPELHO (Microvix -> cache)  [somente leitura pública]
-- =====================================================================

-- Categorias (setor / linha / coleção do Microvix)
create table if not exists public.categories (
  id                uuid primary key default gen_random_uuid(),
  microvix_id       text unique not null,          -- id no Microvix
  kind              text not null default 'setor', -- setor | linha | colecao | marca
  name              text not null,
  parent_id         uuid references public.categories(id) on delete set null,
  source_timestamp  bigint,                         -- cursor de sync do Microvix
  updated_at        timestamptz not null default now()
);

-- Produtos (o "pai" da grade)
create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  microvix_id       text unique not null,          -- cod_produto no Microvix
  reference         text,                           -- referência/SKU pai
  name              text not null,
  brand             text,
  ncm               text,
  category_id       uuid references public.categories(id) on delete set null,
  active_ecommerce  boolean not null default false, -- "Disponível para loja virtual"
  source_timestamp  bigint,
  updated_at        timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_active_idx    on public.products(active_ecommerce);

-- Variantes (a grade tamanho x cor — UNIDADE VENDÁVEL)
create table if not exists public.product_variants (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products(id) on delete cascade,
  microvix_id       text unique not null,           -- id da variante/grade no Microvix
  ean               text,                            -- código de barras (GTIN)
  size              text,                            -- tamanho
  color             text,                            -- cor
  source_timestamp  bigint,
  updated_at        timestamptz not null default now()
);
create index if not exists variants_product_idx on public.product_variants(product_id);
create index if not exists variants_ean_idx      on public.product_variants(ean);

-- Cache de estoque (por depósito) — campo mais volátil, poll mais frequente
create table if not exists public.stock_cache (
  id                uuid primary key default gen_random_uuid(),
  variant_id        uuid not null references public.product_variants(id) on delete cascade,
  deposito_id       text not null,
  qty_available     integer not null default 0,
  last_synced_at    timestamptz not null default now(),
  source_timestamp  bigint,
  unique (variant_id, deposito_id)
);
create index if not exists stock_variant_idx on public.stock_cache(variant_id);

-- Preços (tabela de preço / promoção do Microvix)
create table if not exists public.prices (
  id                uuid primary key default gen_random_uuid(),
  variant_id        uuid not null references public.product_variants(id) on delete cascade,
  tabela_id         text not null default 'default',
  price             numeric(12,2) not null,
  promo_price       numeric(12,2),
  valid_from        timestamptz,
  valid_to          timestamptz,
  source_timestamp  bigint,
  updated_at        timestamptz not null default now(),
  unique (variant_id, tabela_id)
);
create index if not exists prices_variant_idx on public.prices(variant_id);

-- =====================================================================
-- 2. TABELAS PRÓPRIAS DO SITE
-- =====================================================================

-- Camada editorial/SEO sobre o produto (1:1 com products) — dona = site
create table if not exists public.product_content (
  product_id        uuid primary key references public.products(id) on delete cascade,
  slug              text unique not null,
  meta_title        text,
  meta_description  text,
  rich_description  text,
  featured          boolean not null default false,
  sort_order        integer not null default 0,
  gallery           jsonb not null default '[]'::jsonb, -- URLs no Supabase Storage/CDN
  updated_at        timestamptz not null default now()
);
create index if not exists product_content_featured_idx on public.product_content(featured);

-- Clientes (1:1 com auth.users)
create table if not exists public.customers (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text,
  cpf               text,
  phone             text,
  microvix_id       text,                            -- id do cliente no Microvix (após cadastro)
  created_at        timestamptz not null default now()
);

-- Endereços do cliente
create table if not exists public.addresses (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customers(id) on delete cascade,
  label             text,
  cep               text not null,
  street            text not null,
  number            text,
  complement        text,
  district          text,
  city              text not null,
  state             text not null,
  is_default        boolean not null default false,
  created_at        timestamptz not null default now()
);
create index if not exists addresses_customer_idx on public.addresses(customer_id);

-- Carrinho (efêmero)
create table if not exists public.carts (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid references public.customers(id) on delete cascade,
  session_token     text,                            -- carrinho anônimo
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists carts_customer_idx on public.carts(customer_id);

create table if not exists public.cart_items (
  id                uuid primary key default gen_random_uuid(),
  cart_id           uuid not null references public.carts(id) on delete cascade,
  variant_id        uuid not null references public.product_variants(id),
  qty               integer not null check (qty > 0),
  created_at        timestamptz not null default now(),
  unique (cart_id, variant_id)
);

-- Reservas de estoque (guarda local com TTL — evita overselling entre polls)
create table if not exists public.reservations (
  id                uuid primary key default gen_random_uuid(),
  variant_id        uuid not null references public.product_variants(id) on delete cascade,
  cart_id           uuid references public.carts(id) on delete cascade,
  qty               integer not null check (qty > 0),
  expires_at        timestamptz not null,
  created_at        timestamptz not null default now()
);
create index if not exists reservations_variant_idx  on public.reservations(variant_id);
create index if not exists reservations_expires_idx  on public.reservations(expires_at);

-- Pedidos
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid references public.customers(id) on delete set null,
  status            text not null default 'pending',   -- pending|paid|failed|shipped|canceled
  payment_status    text not null default 'pending',   -- pending|approved|rejected|refunded
  subtotal          numeric(12,2) not null default 0,
  shipping_total    numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,
  shipping_method   text,
  shipping_address  jsonb,
  microvix_order_id text,                              -- id após B2CCadastraPedido
  microvix_synced_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists orders_customer_idx on public.orders(customer_id);
create index if not exists orders_status_idx    on public.orders(status);

create table if not exists public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  variant_id        uuid not null references public.product_variants(id),
  -- SNAPSHOT no momento da compra (nunca reler do cache mutável):
  product_name      text not null,
  variant_label     text,                              -- ex. "P / Azul"
  unit_price        numeric(12,2) not null,
  qty               integer not null check (qty > 0),
  created_at        timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- Pagamentos
create table if not exists public.payments (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  provider          text not null,                     -- mercadopago | pagarme
  provider_id       text not null,                     -- id do pagamento no provedor
  status            text not null default 'pending',
  amount            numeric(12,2) not null,
  raw               jsonb,
  created_at        timestamptz not null default now(),
  unique (provider, provider_id)                       -- idempotência de webhook
);
create index if not exists payments_order_idx on public.payments(order_id);

-- =====================================================================
-- 3. ESTADO DE SINCRONIZAÇÃO (dono = worker)
-- =====================================================================
create table if not exists public.sync_state (
  method            text primary key,                  -- ex. B2CConsultaProdutosDetalhesDepositos
  watermark         bigint not null default 0,         -- último timestamp/cursor processado
  updated_at        timestamptz not null default now()
);

create table if not exists public.sync_runs (
  id                uuid primary key default gen_random_uuid(),
  method            text not null,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  rows_affected     integer,
  ok                boolean,
  error             text
);
create index if not exists sync_runs_method_idx on public.sync_runs(method, started_at desc);

-- =====================================================================
-- 4. RLS
-- =====================================================================
-- Habilita RLS em tudo.
alter table public.categories        enable row level security;
alter table public.products          enable row level security;
alter table public.product_variants  enable row level security;
alter table public.stock_cache       enable row level security;
alter table public.prices            enable row level security;
alter table public.product_content   enable row level security;
alter table public.customers         enable row level security;
alter table public.addresses         enable row level security;
alter table public.carts             enable row level security;
alter table public.cart_items        enable row level security;
alter table public.reservations      enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.payments          enable row level security;
alter table public.sync_state        enable row level security;
alter table public.sync_runs         enable row level security;

-- --- Catálogo: leitura pública (anon + authenticated), SEM escrita pelo cliente.
create policy "catalog_read_categories"  on public.categories       for select to anon, authenticated using (true);
create policy "catalog_read_products"     on public.products         for select to anon, authenticated using (active_ecommerce = true);
create policy "catalog_read_variants"     on public.product_variants for select to anon, authenticated using (true);
create policy "catalog_read_stock"        on public.stock_cache      for select to anon, authenticated using (true);
create policy "catalog_read_prices"       on public.prices           for select to anon, authenticated using (true);
create policy "catalog_read_content"      on public.product_content  for select to anon, authenticated using (true);

-- --- Cliente: cada um vê/edita só o que é seu (auth.uid()).
create policy "own_customer_select" on public.customers for select to authenticated using (id = auth.uid());
create policy "own_customer_upsert" on public.customers for insert to authenticated with check (id = auth.uid());
create policy "own_customer_update" on public.customers for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "own_addresses_all"   on public.addresses  for all to authenticated
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create policy "own_orders_select"   on public.orders     for select to authenticated using (customer_id = auth.uid());
create policy "own_order_items_select" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));

-- Observações:
--   * carts/cart_items/reservations/payments/orders (escrita) e as tabelas de sync
--     não recebem policy de escrita: são manipuladas SOMENTE server-side (service_role,
--     que ignora RLS) — Edge Functions / Route Handlers / worker. Sem service_role, o
--     cliente não consegue gravar, que é o comportamento desejado.
--   * Antes de expor qualquer escrita ao cliente, criar policy explícita.
