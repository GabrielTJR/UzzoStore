-- 0021 — Fecha três buracos entre o relógio da reserva e a entrada do dinheiro.
--
-- Achados ao preparar a integração com o Linx Microvix: o plano de sincronizar
-- estoque com o ERP se apoiaria nestes mecanismos, e a revisão mostrou que eles
-- têm janelas em que o saldo mente. Os três são independentes do Microvix — são
-- defeitos do site de hoje.
--
--   1. O `pg_cron` podia expirar um pedido que ACABOU de ser pago.
--      A condição `payment_status = 'pending'` só existia no CTE, avaliado no
--      instante do snapshot; o UPDATE final não reconferia. Entre uma coisa e
--      outra o `confirmPayment` cabe inteiro.
--
--   2. O `confirmPayment` não conseguia saber em que situação o pedido ESTAVA.
--      Ele lia `payment_status` numa consulta anterior e decidia com um valor
--      que podia ter mudado. Precisa da situação antiga e da escrita no MESMO
--      comando, senão a decisão de "preciso separar a peça de novo?" é chute.
--
--   3. A reserva de estoque não era atômica. `reservarParaPedido` baixava o
--      estoque com N chamadas e SÓ DEPOIS gravava as linhas de `reservations`.
--      Se o processo morresse no meio (timeout, deploy, exceção), a peça saía
--      do estoque sem reserva nenhuma para o cron expirar — sumia do catálogo
--      para sempre, em silêncio.

-- =====================================================================
-- 1. Expiração que não atropela pagamento recém-confirmado
-- =====================================================================
create or replace function public.expira_pedidos_nao_pagos()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  afetados int;
begin
  with vencidos as (
    select id
      from public.orders
     where payment_status = 'pending'
       and channel = 'online'
       and expires_at is not null
       and expires_at < now()
     -- Trava as linhas escolhidas. `skip locked` deixa passar o pedido que
     -- está sendo pago NESTE instante em vez de disputar com ele: quem está
     -- com dinheiro na mão tem preferência, e o pedido pulado será reavaliado
     -- na próxima varredura (5 min) — se tiver virado 'paid', some do filtro
     -- sozinho.
     for update skip locked
  ),
  -- Agrupa por variante ANTES de somar: um UPDATE só toca cada linha uma vez,
  -- então duas reservas da mesma variante devolveriam apenas uma sem o group by.
  devolucao as (
    select r.variant_id, sum(r.qty)::int as qty
      from public.reservations r
     where r.order_id in (select id from vencidos)
     group by r.variant_id
  ),
  devolve as (
    update public.stock_cache s
       set qty_available = s.qty_available + d.qty,
           -- NÃO zerar direto. Duas compras podem segurar a MESMA variante; se
           -- só uma expira, apagar a marca faria a vitrine dizer "esgotado"
           -- para a peça que continua reservada — a mentira que a 0020 veio
           -- justamente evitar. Recalcula a partir do que sobrou vivo.
           -- (`not exists` e não `not in`: reserva de carrinho tem order_id
           -- nulo, e `not in` com NULL devolveria nada.)
           reservado_ate = (
             select max(r2.expires_at)
               from public.reservations r2
              where r2.variant_id = s.variant_id
                and not exists (
                  select 1 from vencidos v where v.id = r2.order_id
                )
           )
      from devolucao d
     where s.variant_id = d.variant_id
       and s.deposito_id = 'loja'
    returning s.variant_id
  ),
  limpa as (
    delete from public.reservations
     where order_id in (select id from vencidos)
    returning id
  )
  update public.orders
     set payment_status     = 'expired',
         fulfillment_status = 'canceled',
         updated_at         = now()
   where id in (select id from vencidos)
     -- Quem de fato protege é o `for update skip locked` lá em cima: o pedido
     -- que está sendo pago neste instante nem entra em `vencidos`. Esta
     -- condição é cinto além do suspensório — como já seguramos o lock da
     -- linha, ela na prática nunca filtra nada. Fica porque custa zero e porque
     -- a garantia deixa de depender de um detalhe do plano de execução.
     and payment_status = 'pending';

  get diagnostics afetados = row_count;
  return afetados;
end;
$$;

comment on function public.expira_pedidos_nao_pagos() is
  'Devolve o estoque e cancela pedidos online não pagos dentro da janela. Trava as linhas com skip locked e reconfere payment_status na escrita: pagamento em curso tem preferência.';

-- =====================================================================
-- 2. Marcar pago devolvendo a situação ANTERIOR, no mesmo comando
-- =====================================================================
--
-- Trava a linha, lê a situação vigente, escreve. Ler numa consulta e escrever
-- noutra — que é o que o TypeScript fazia — deixa o `pg_cron` caber no meio: o
-- chamador decide "não preciso separar a peça de novo" com um valor que já
-- mudou.
--
-- ⚠️ Não use o truque do auto-join (`update orders o ... from orders prev ...
-- returning prev.payment_status`). Ele parece resolver e falha exatamente no
-- caso concorrente: sob READ COMMITTED, quando o UPDATE espera numa linha
-- alterada por outra transação, a relação do FROM é rebuscada pelo TID do
-- snapshot ORIGINAL e devolve o valor de antes da expiração. `RETURNING OLD.*`
-- resolveria, mas é Postgres 18 e aqui é 17.6.
--
-- Devolve NULL quando não escreveu nada — pedido inexistente ou já estornado.
-- Estornado NÃO volta a ser pago: o dinheiro já saiu de volta.
create or replace function public.marcar_pedido_pago(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  anterior text;
begin
  select payment_status into anterior
    from public.orders
   where id = p_order_id
     for update;

  if anterior is null then return null; end if;       -- pedido inexistente
  if anterior = 'refunded' then return null; end if;  -- estornado não revive

  update public.orders
     set payment_status = 'paid',
         updated_at     = now()
   where id = p_order_id;

  return anterior;
end;
$$;

comment on function public.marcar_pedido_pago(uuid) is
  'Marca o pedido como pago e devolve a situação em que ele ESTAVA. NULL = não escreveu (inexistente ou estornado). Recusa reviver pedido estornado.';

-- =====================================================================
-- 3. Reserva atômica: baixa o estoque e grava a reserva juntas ou nenhuma
-- =====================================================================
--
-- p_itens: [{"variant_id": "<uuid>", "qty": 2}, ...]
-- Devolve: array com os variant_id SEM saldo. Vazio = reservou tudo.
--
-- Duas passadas de propósito. A primeira TRAVA as linhas de estoque em ordem de
-- variant_id (ordem determinística evita impasse entre dois pedidos com as
-- mesmas peças em ordem trocada) e confere o saldo. Só se tudo couber é que a
-- segunda escreve. Assim nunca existe o estado "estoque baixado, reserva
-- ausente" que o código em TypeScript produzia quando morria no meio.
create or replace function public.reservar_pedido(
  p_order_id   uuid,
  p_itens      jsonb,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  faltou jsonb;
begin
  -- Entrada inválida é ERRO, não "reservou tudo". Sem estas guardas uma lista
  -- vazia devolveria '[]' — que o chamador lê como sucesso — e o pedido seguiria
  -- comprometido sem nenhuma reserva, que é justamente o estado que esta função
  -- existe para impedir. `qty` nula faria `qty_available < qty` dar NULL, o item
  -- passaria, e a subtração violaria o NOT NULL com um 500 cru; `qty` negativa
  -- INFLARIA o estoque antes de o insert bater no check da tabela.
  -- (Mesmo espírito do `p_qty <= 0` que abre o `decrement_stock`, migração 0012.)
  if p_itens is null or jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 then
    raise exception 'reservar_pedido: lista de itens vazia';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_itens) i
     where (i->>'variant_id') is null
        or (i->>'qty') is null
        or (i->>'qty')::int <= 0
  ) then
    raise exception 'reservar_pedido: item sem variant_id ou com qty inválida';
  end if;

  -- Passada 1: trava as linhas de estoque envolvidas, em ordem de variant_id.
  -- A ordem é o que evita impasse quando dois pedidos levam as mesmas peças em
  -- sequência trocada. Sem agregação e sem outer join, que `for update` recusa.
  perform 1
    from public.stock_cache s
   where s.deposito_id = 'loja'
     and s.variant_id in (
       select distinct (i->>'variant_id')::uuid
         from jsonb_array_elements(p_itens) i
     )
   order by s.variant_id
     for update;

  -- Confere o saldo com as linhas já travadas. O agrupamento é obrigatório: o
  -- mesmo SKU pode aparecer em duas linhas do pedido, e conferir uma de cada
  -- vez aprovaria 1 + 1 contra um saldo de 1.
  select coalesce(jsonb_agg(t.variant_id), '[]'::jsonb)
    into faltou
    from (
      select (i->>'variant_id')::uuid as variant_id,
             sum((i->>'qty')::int)    as qty
        from jsonb_array_elements(p_itens) i
       group by 1
    ) t
    left join public.stock_cache s
      on s.variant_id = t.variant_id
     and s.deposito_id = 'loja'
   where s.variant_id is null
      or s.qty_available < t.qty;

  -- Nada foi escrito ainda: sair aqui é o "tudo ou nada" sem precisar desfazer.
  if jsonb_array_length(faltou) > 0 then
    return faltou;
  end if;

  -- Passada 2: escreve. As linhas seguem travadas até o fim da transação.
  update public.stock_cache s
     set qty_available = s.qty_available - t.qty,
         reservado_ate = p_expires_at
    from (
      select (i->>'variant_id')::uuid as variant_id,
             sum((i->>'qty')::int)    as qty
        from jsonb_array_elements(p_itens) i
       group by 1
    ) t
   where s.variant_id = t.variant_id
     and s.deposito_id = 'loja';

  insert into public.reservations (order_id, variant_id, qty, expires_at)
  select p_order_id, (i->>'variant_id')::uuid, sum((i->>'qty')::int), p_expires_at
    from jsonb_array_elements(p_itens) i
   group by 2;

  return '[]'::jsonb;
end;
$$;

comment on function public.reservar_pedido(uuid, jsonb, timestamptz) is
  'Baixa o estoque E grava a reserva na mesma transação. Devolve os variant_id sem saldo (vazio = ok). Substitui a sequência baixar-depois-reservar, que deixava estoque preso se o processo morresse no meio.';

-- =====================================================================
-- Permissões — mesmo padrão do decrement_stock (migração 0012)
-- =====================================================================
-- Estas funções são `security definer` e decidem sobre dinheiro e estoque.
-- Só o servidor (service_role) pode chamá-las; nunca o navegador.
revoke all on function public.marcar_pedido_pago(uuid) from public, anon, authenticated;
revoke all on function public.reservar_pedido(uuid, jsonb, timestamptz) from public, anon, authenticated;

grant execute on function public.marcar_pedido_pago(uuid) to service_role;
grant execute on function public.reservar_pedido(uuid, jsonb, timestamptz) to service_role;

-- `expira_pedidos_nao_pagos` fica com as permissões que já tinha, de propósito:
-- quem a chama é o pg_cron, e mexer nos grants de uma função agendada é a
-- maneira mais fácil de desligar a expiração sem ninguém perceber.

-- =====================================================================
-- 4. Uma reserva por (pedido, variante)
-- =====================================================================
-- Sem isto, chamar `reservar_pedido` duas vezes para o mesmo pedido baixaria o
-- estoque de novo e criaria uma segunda linha de reserva — e a expiração
-- devolveria o dobro do que saiu. A tabela está vazia hoje, então o índice
-- nasce limpo. O `where` existe porque reserva de carrinho tem `order_id` nulo.
create unique index if not exists reservations_order_variant_uidx
  on public.reservations (order_id, variant_id)
  where order_id is not null;
