-- Baixa de estoque ATÔMICA.
--
-- Antes a baixa era "ler qty_available, subtrair no JS, gravar" — dois pedidos
-- ao mesmo tempo liam o mesmo saldo e a loja vendia a peça duas vezes. Aqui a
-- condição `qty_available >= p_qty` vai no próprio UPDATE: o banco resolve a
-- disputa e devolve -1 quando não havia saldo.
create or replace function public.decrement_stock(p_variant_id uuid, p_qty int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  restante int;
begin
  if p_qty is null or p_qty <= 0 then
    return -1;
  end if;

  update public.stock_cache
  set qty_available = qty_available - p_qty
  where variant_id = p_variant_id
    and deposito_id = 'loja'
    and qty_available >= p_qty
  returning qty_available into restante;

  if not found then
    return -1;  -- sem saldo (ou variante sem linha de estoque)
  end if;
  return restante;
end;
$$;

-- Só o servidor chama (nunca o navegador).
revoke all on function public.decrement_stock(uuid, int) from public;
revoke all on function public.decrement_stock(uuid, int) from anon;
revoke all on function public.decrement_stock(uuid, int) from authenticated;
grant execute on function public.decrement_stock(uuid, int) to service_role;
