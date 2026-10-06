-- Consome 1 uso de cupom NO MESMO COMANDO que confere o limite.
--
-- O site lia `used_count`, somava 1 e gravava em passos separados: dois
-- pagamentos chegando juntos liam o mesmo número e um uso se perdia — com
-- `max_uses`, o cupom aceitava mais usos que o limite.
--
-- Devolve true quando consumiu; false quando o limite já estava atingido (ou
-- o cupom não existe). Quem chama NÃO desfaz a venda por isso — o dinheiro já
-- entrou —, só registra para a loja ver.
--
-- Só o servidor (service_role) chama. Idempotente: `create or replace`.
create or replace function public.consumir_cupom(p_code text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with usado as (
    update public.coupons
       set used_count = used_count + 1
     where code = p_code
       and (max_uses is null or used_count < max_uses)
    returning 1
  )
  select exists (select 1 from usado);
$$;

revoke all on function public.consumir_cupom(text) from public, anon, authenticated;
grant execute on function public.consumir_cupom(text) to service_role;
