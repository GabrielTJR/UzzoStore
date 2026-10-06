-- 0030 — prazo de entrega no pedido + convite para avaliar.
--
-- shipping_days: prazo (dias ÚTEIS) do frete escolhido, como a cotação do
--   Melhor Envio informou na hora da compra. É o que vira "chega até dd/mm"
--   na conta do cliente e no e-mail de envio. Nulo em retirada, em frete a
--   combinar e nos pedidos anteriores a esta migração.
-- review_request_sent_at: quando a rotina diária mandou o convite para
--   avaliar as peças (um por pedido; marcado ANTES do envio, condicional).
--
-- Idempotente.

alter table public.orders
  add column if not exists shipping_days smallint,
  add column if not exists review_request_sent_at timestamptz;
