-- Busca insensível a acento na vitrine.
--
-- Antes: `ilike '%termo%'` direto em products.name. Quem digita "calca" no
-- celular (sem acento) não achava "CALÇA", e o cadastro do ERP é inconsistente
-- ("SUETER" sem acento, "CALÇA" com). Falhava nos dois sentidos.
--
-- `unaccent` não é IMMUTABLE (depende do dicionário), então não pode ir direto
-- numa coluna gerada. Envelopamos numa função IMMUTABLE própria — padrão
-- conhecido: o dicionário unaccent é estável na prática e o índice só é usado
-- por esta busca.
create extension if not exists unaccent with schema extensions;

create or replace function public.imm_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

-- Coluna materializada: já normalizada (minúscula, sem acento).
alter table public.products
  add column if not exists name_search text
  generated always as (lower(public.imm_unaccent(name))) stored;

-- Trigram para o `%termo%` continuar rápido conforme o catálogo cresce.
create extension if not exists pg_trgm with schema extensions;
create index if not exists products_name_search_trgm
  on public.products using gin (name_search extensions.gin_trgm_ops);
