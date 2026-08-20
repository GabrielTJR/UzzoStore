-- 0019 — A vitrine precisa saber que o saldo zero é RESERVA, não fim de estoque.
--
-- "Esgotado" para uma peça que pode voltar em 20 minutos é mentira, e mentira
-- que faz o cliente ir embora de vez em vez de esperar. Mas `reservations` não
-- tem policy pública e não deve ter: a tabela carrega `order_id` e revelaria o
-- tamanho da fila de compra de cada peça.
--
-- A view entrega SÓ o que a vitrine precisa — quais variantes estão reservadas
-- agora — sem abrir a tabela. Fica com `security_invoker = false` (o padrão) de
-- propósito: atravessar o RLS expondo uma única coluna é exatamente o objetivo.
create or replace view public.variantes_reservadas as
select distinct variant_id
  from public.reservations
 where expires_at > now();

comment on view public.variantes_reservadas is
  'Variantes com reserva ativa. Uma coluna só, de leitura pública, para a vitrine dizer "em processo de compra" em vez de "esgotado". Não expõe pedido nem quantidade.';

grant select on public.variantes_reservadas to anon, authenticated;
