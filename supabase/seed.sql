-- Dados de TESTE (Fase 1). Produtos/variantes com microvix_id/prefixo 'seed-' para fácil remoção:
--   delete from public.products where microvix_id like 'seed-%';  (cascata para cores/variantes/estoque/conteúdo)
-- As cores do cadastro geral (public.colors) são globais e permanecem.
-- Substituídos pelos dados reais quando a sincronização com o Microvix entrar.

-- Categorias
insert into public.categories (microvix_id, kind, name) values
  ('seed-cat-camisetas','setor','Camisetas'),
  ('seed-cat-camisas','setor','Camisas'),
  ('seed-cat-calcas','setor','Calças'),
  ('seed-cat-bermudas','setor','Bermudas'),
  ('seed-cat-moletons','setor','Moletons'),
  ('seed-cat-acessorios','setor','Acessórios')
on conflict (microvix_id) do nothing;

-- Cadastro GERAL de cores (nomes padronizados + swatch)
insert into public.colors (name, hex, sort_order) values
  ('Preto','#111111',1),
  ('Off-White','#efe9dd',2),
  ('Areia','#cbb491',3),
  ('Azul-marinho','#1f2a44',4)
on conflict (name) do nothing;

-- Produtos (preço GLOBAL por produto)
insert into public.products (microvix_id, reference, name, brand, category_id, active_ecommerce, price)
select d.mid, d.ref, d.name, 'Uzzo', c.id, true, d.price
from (values
  ('seed-prod-1','UZ-CAM-001','Camiseta Tech Dry Preta','seed-cat-camisetas',129.90),
  ('seed-prod-2','UZ-CAM-002','Camiseta Básica Off-White','seed-cat-camisetas',99.90),
  ('seed-prod-3','UZ-CMS-001','Camisa Slim de Linho','seed-cat-camisas',199.90),
  ('seed-prod-4','UZ-CMS-002','Camisa Social Preta','seed-cat-camisas',219.90),
  ('seed-prod-5','UZ-CAL-001','Calça de Alfaiataria','seed-cat-calcas',259.90),
  ('seed-prod-6','UZ-BER-001','Bermuda Sarja Areia','seed-cat-bermudas',149.90),
  ('seed-prod-7','UZ-MOL-001','Moletom Essential','seed-cat-moletons',189.90),
  ('seed-prod-8','UZ-ACS-001','Boné Uzzo Logo','seed-cat-acessorios',89.90)
) as d(mid, ref, name, cat, price)
join public.categories c on c.microvix_id = d.cat
on conflict (microvix_id) do nothing;

-- Cor de cada produto (product_colors) — 1 cor por produto de teste, herda a galeria (vazia)
insert into public.product_colors (product_id, color_id, sort_order)
select p.id, col.id, 0
from (values
  ('seed-prod-1','Preto'),
  ('seed-prod-2','Off-White'),
  ('seed-prod-3','Off-White'),
  ('seed-prod-4','Preto'),
  ('seed-prod-5','Preto'),
  ('seed-prod-6','Areia'),
  ('seed-prod-7','Azul-marinho'),
  ('seed-prod-8','Preto')
) as m(mid, color)
join public.products p on p.microvix_id = m.mid
join public.colors col on col.name = m.color
where not exists (
  select 1 from public.product_colors x where x.product_id = p.id
);

-- Variantes (grade P/M/G) sob a cor do produto
insert into public.product_variants (microvix_id, product_id, product_color_id, size, color)
select 'seed-var-'||p.microvix_id||'-'||s.size, p.id, pc.id, s.size, col.name
from public.products p
join public.product_colors pc on pc.product_id = p.id
join public.colors col on col.id = pc.color_id
cross join (values ('P'),('M'),('G')) as s(size)
where p.microvix_id like 'seed-prod-%'
on conflict (microvix_id) do nothing;

-- Estoque
insert into public.stock_cache (variant_id, deposito_id, qty_available)
select v.id, 'loja', 10
from public.product_variants v
where v.microvix_id like 'seed-var-%'
on conflict (variant_id, deposito_id) do nothing;

-- Conteúdo/SEO (slug, destaque). A galeria de fotos agora vive em product_colors.
insert into public.product_content (product_id, slug, meta_title, meta_description, rich_description, featured, sort_order, gallery)
select p.id, d.slug, d.name, 'Moda masculina Uzzo Store.',
       'Peça da coleção Uzzo Store. Descrição detalhada em breve.', d.featured, d.ord, '[]'::jsonb
from public.products p
join (values
  ('seed-prod-1','camiseta-tech-dry-preta','Camiseta Tech Dry Preta',true,1),
  ('seed-prod-2','camiseta-basica-off-white','Camiseta Básica Off-White',false,2),
  ('seed-prod-3','camisa-slim-de-linho','Camisa Slim de Linho',true,3),
  ('seed-prod-4','camisa-social-preta','Camisa Social Preta',false,4),
  ('seed-prod-5','calca-de-alfaiataria','Calça de Alfaiataria',true,5),
  ('seed-prod-6','bermuda-sarja-areia','Bermuda Sarja Areia',false,6),
  ('seed-prod-7','moletom-essential','Moletom Essential',true,7),
  ('seed-prod-8','bone-uzzo-logo','Boné Uzzo Logo',false,8)
) as d(mid, slug, name, featured, ord) on d.mid = p.microvix_id
on conflict (product_id) do nothing;
