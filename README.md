# Uzzo Store

Loja virtual da **Uzzo Store** (Balneário Camboriú/SC), integrada ao ERP **Linx Microvix** como fonte de verdade de produtos, estoque e preços.

- **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres/Auth/Storage).
- **Arquitetura completa:** ver [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha as variáveis
npm run dev
```

Abre em http://localhost:3000.

## Banco de dados (Supabase)

O esquema inicial (tabelas + RLS) está em [`supabase/migrations/20260725163425_0001_initial_schema.sql`](supabase/migrations/20260725163425_0001_initial_schema.sql).
Aplique via Supabase CLI (`supabase db push`) ou colando no SQL Editor do projeto.

## Estrutura

```
src/
  app/                 # rotas (App Router)
  lib/supabase/        # clientes Supabase (client.ts = browser, server.ts = server)
supabase/migrations/   # esquema do banco
docs/ARQUITETURA.md    # decisões de arquitetura, integração Microvix, roadmap
```

## Status

🚧 **Fase 0 — fundação.** Próximas fases (catálogo, checkout, pagamento, integração Microvix) em `docs/ARQUITETURA.md`.
