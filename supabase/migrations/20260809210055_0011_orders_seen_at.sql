-- Marca quando a loja já viu o pedido, para destacar os NOVOS em /admin/pedidos
-- e mostrar um contador no menu do painel.
alter table public.orders add column if not exists seen_at timestamptz;

-- Pedidos que já existem entram como "já vistos" (não faz sentido alertar
-- sobre pedido antigo ao ligar a funcionalidade).
update public.orders set seen_at = now() where seen_at is null;
