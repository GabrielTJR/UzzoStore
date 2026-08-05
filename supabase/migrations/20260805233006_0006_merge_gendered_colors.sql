-- =====================================================================
-- 0006 — Unifica cores duplicadas por gênero: "Branca" -> "Branco",
--        "Preta" -> "Preto" (o cadastro global tinha os dois pares).
--
-- As fotos (product_colors.gallery) e as variantes/estoque penduram em
-- product_colors, então RELIGAMOS a linha existente (troca só o color_id) em
-- vez de recriar — nenhum produto perde vínculo, foto ou estoque.
-- Conferido antes de aplicar: nenhum produto tinha as duas cores do par.
-- =====================================================================

-- 1) Religa produto×cor da versão feminina para a masculina.
--    O `not exists` protege o unique (product_id, color_id): se algum produto já
--    tivesse as duas cores, a linha ficaria como está (e o delete abaixo falharia,
--    de forma explícita, em vez de corromper dados).
with pairs as (
  select d.id as dup_id, c.id as canon_id
  from (values ('branca','branco'), ('preta','preto')) as p(dup, canon)
  join public.colors d on lower(d.name) = p.dup
  join public.colors c on lower(c.name) = p.canon
)
update public.product_colors pc
set color_id = pairs.canon_id, updated_at = now()
from pairs
where pc.color_id = pairs.dup_id
  and not exists (
    select 1 from public.product_colors x
    where x.product_id = pc.product_id and x.color_id = pairs.canon_id
  );

-- 2) Sincroniza o texto `color` da variante com o nome da cor (campo espelho do Microvix).
update public.product_variants v
set color = c.name, updated_at = now()
from public.product_colors pc
join public.colors c on c.id = pc.color_id
where v.product_color_id = pc.id
  and v.color is distinct from c.name;

-- 3) Remove as cores duplicadas — só se já estiverem sem uso.
delete from public.colors
where lower(name) in ('branca','preta')
  and not exists (
    select 1 from public.product_colors pc where pc.color_id = colors.id
  );
