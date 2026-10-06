-- Cupom que cada cliente usa UMA vez (decisão do dono, 06/10/2026: o
-- BEMVINDO10 é de boas-vindas e valia infinitas vezes para a mesma conta).
--
-- Quem confere é o servidor do site (`src/lib/coupons.ts`): conta os pedidos
-- do cliente com o código que já consumiram o cupom — pagos no site, ou de
-- WhatsApp não cancelados. Cupom com a marca exige login para ser usado.
--
-- Idempotente: rodar de novo não faz nada.
alter table public.coupons
  add column if not exists uma_por_cliente boolean not null default false;

update public.coupons
   set uma_por_cliente = true
 where code in ('BEMVINDO10', 'BEMVINDO'); -- o do painel se chama BEMVINDO
