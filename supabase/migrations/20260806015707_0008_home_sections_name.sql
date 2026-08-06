-- Nome do bloco, definido pelo admin (ex.: "Banner Dia dos Pais"). Serve só
-- para identificar na tela /admin/decoracao — não aparece na loja.
alter table public.home_sections add column if not exists name text;

-- Blocos que já existem ficam com o rótulo do tipo.
update public.home_sections
set name = case kind
  when 'aviso'   then 'Faixa de aviso'
  when 'banner'  then 'Banner principal'
  when 'mosaico' then 'Mosaico de coleções'
  else 'Vitrine de produtos'
end
where name is null;
