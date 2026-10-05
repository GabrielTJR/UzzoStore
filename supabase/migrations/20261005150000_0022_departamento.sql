-- =====================================================================
-- 0022 — Departamento do produto (Masculino / Feminino / Unissex)
--
-- A loja era só masculina e passa a ter seção feminina. O departamento é um
-- atributo do PRODUTO (não da categoria): "Camisetas" existe nos dois, e uma
-- peça unissex precisa aparecer nas duas seções.
--
--   masculino → /masculino        feminino → /feminino
--   unissex   → aparece nas duas
--
-- Tudo que existe hoje é masculino, daí o default. A coluna é `not null` com
-- default para nenhum caminho de escrita (admin, e no futuro o worker do
-- Microvix) conseguir criar produto "sem departamento", que sumiria das duas
-- seções.
--
-- ⚠️ `products` é tabela ESPELHO do Microvix, mas esta coluna é do SITE (como
-- `weight_grams` e `measurement_model_id`): quando a sincronização do ERP
-- entrar, ela NÃO pode sobrescrever `department` — ou precisa mapeá-lo de um
-- campo do ERP, decidido na fase 1.
--
-- Idempotente (`if not exists`): pode ser colada no SQL Editor e, depois,
-- reaplicada pelo `supabase db push` sem erro.
--
-- DEPOIS DE APLICAR: trocar `DEPARTMENT_COLUMN_READY` para `true` em
-- src/lib/departments.ts. Enquanto for `false`, o código não toca na coluna.
-- =====================================================================

alter table public.products
  add column if not exists department text not null default 'masculino'
    constraint products_department_check
      check (department in ('masculino', 'feminino', 'unissex'));

comment on column public.products.department is
  'Seção da loja: masculino | feminino | unissex (unissex aparece nas duas). Coluna do site, não do ERP.';

-- O catálogo filtra por departamento em toda listagem de seção.
create index if not exists products_department_idx
  on public.products (department)
  where active_ecommerce;
