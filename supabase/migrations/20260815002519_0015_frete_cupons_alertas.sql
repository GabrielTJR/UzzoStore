-- Frete (Melhor Envio), cupons, newsletter e aviso de volta ao estoque.

-- Peso para cotação de frete: por produto, em GRAMAS. Nulo = usa o padrão por
-- categoria (src/lib/shipping.ts). Não é dado do Microvix — coluna própria.
alter table public.products
  add column if not exists weight_grams integer;

-- Pedido ganha frete/desconto/rastreio (fase 1: cotação; etiqueta depois).
alter table public.orders
  add column if not exists shipping_cost numeric(10,2) not null default 0,
  add column if not exists shipping_service text,
  add column if not exists coupon_code text,
  add column if not exists discount numeric(10,2) not null default 0,
  add column if not exists tracking_code text;

-- Cupons de desconto. SEM policy pública de propósito: quem valida/aplica é o
-- servidor (service_role) — expor SELECT permitiria enumerar códigos.
create table if not exists public.coupons (
  code text primary key,
  percent_off numeric(5,2) not null check (percent_off > 0 and percent_off <= 90),
  min_subtotal numeric(10,2) not null default 0,
  active boolean not null default true,
  max_uses integer,          -- nulo = ilimitado
  used_count integer not null default 0,
  expires_at timestamptz,    -- nulo = não expira
  created_at timestamptz not null default now()
);
alter table public.coupons enable row level security;

-- Newsletter (captura de e-mail no rodapé). Só service_role escreve/lê.
create table if not exists public.newsletter_subscribers (
  email text primary key,
  source text,
  created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;

-- "Avise-me quando chegar": interessados por variante esgotada.
create table if not exists public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (variant_id, email)
);
alter table public.stock_alerts enable row level security;
create index if not exists stock_alerts_pending_idx
  on public.stock_alerts (variant_id) where notified_at is null;
