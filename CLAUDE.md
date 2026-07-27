# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> ⚠️ **Next.js 16** (App Router, React 19, Turbopack). APIs differ from older Next — heed the AGENTS.md note above and consult `node_modules/next/dist/docs/` for anything version-sensitive. Notably: `params`/`searchParams` in pages are **Promises** (`await` them); the request-interception convention is **`proxy.ts`**, NOT `middleware.ts`.

## Commands

Run everything from the `UzzoStore/` directory.

- `npm run dev` — dev server (Turbopack), http://localhost:3000
- `npm run build` — **the validation gate**: runs TypeScript typecheck + ESLint + production build. There is **no test suite**; run `npm run build` to verify a change compiles and typechecks before committing.
- `npm run lint` — ESLint only

Windows/env notes: the `gh` CLI may be missing from the Bash tool's PATH — call it by full path (`C:\Program Files\GitHub CLI\gh.exe`). The repo lives under a OneDrive path.

## What this is

E-commerce for **Uzzo Store** (menswear, Balneário Camboriú/SC). Full design rationale, integration details, and phased roadmap live in **`docs/ARQUITETURA.md`** — read it before large changes.

The store's ERP, **Linx Microvix, is the *intended* source of truth** for products/stock/prices, but that integration is **not built yet** (Microvix is poll-only; blocked on a B2C access key). Until then, products/prices/stock are managed **manually through the admin**. Code is structured so Microvix can later own the "mirror" tables without reworking the storefront.

## Backend: Supabase (three clients — do not mix)

- `src/lib/supabase/client.ts` — browser, anon key. Client Components.
- `src/lib/supabase/server.ts` — server, anon key + cookies (RLS-scoped). Server Components.
- `src/lib/supabase/admin.ts` — **service_role, bypasses RLS, `server-only`**. Use ONLY inside server actions, and only after `getAdminUser()` passes.

Session refresh runs in `src/proxy.ts` → `src/lib/supabase/middleware.ts` (`updateSession`).

## Data model (see `supabase/migrations/0001_initial_schema.sql`)

Two categories of tables — this split drives everything:

- **Mirror tables** (`products`, `product_variants`, `stock_cache`, `prices`, `categories`): destined to be owned by Microvix; the storefront treats them as a read cache and must not depend on editing them from the client.
- **Site-owned** (`product_content` = slug/SEO/`gallery`, `customers`, `carts`, `cart_items`, `reservations`, `orders`, `order_items`, `payments`, `sync_state`).

Key facts: the **sellable unit is the variant** (size×color "grade"), not the product; **price is per-variant** (`prices`), **stock is per-variant** (`stock_cache`); a product only appears in the storefront when `active_ecommerce = true`; `product_content.gallery` is a JSON array of Storage image URLs.

**RLS is on for every table.** Catalog tables allow public `SELECT`; customer/order tables are scoped to `auth.uid()`; `carts`/`order`/`payments`/`sync_*` have **no write policy on purpose** — only the service_role (server-side) writes them.

## Storefront

Server Components fetch via `src/lib/products.ts` (`getProducts`, `getProductBySlug`). Nested Supabase embeds are cast to local `Row` types via `as unknown as` — deliberate, to avoid brittle generated-type inference on deep selects. The category menu is a **static list in `src/lib/categories.ts`** whose names must match the DB category names. Cart is **client-side** (`src/lib/cart-store.ts`, Zustand + localStorage); checkout currently builds a **WhatsApp order message** (`/sacola`) — no online payment yet.

## Admin (`/admin`) & auth roles

- **Roles live in the DB** (migration `0003`): table `public.admins` (`role` owner|admin, `full_name`, `must_change_password`) + SQL function `is_admin()`. `getAdminUser` (`src/lib/admin.ts`) is a **dual-gate** — `is_admin()` is the source of truth; the `ADMIN_EMAILS` env is only a bootstrap fallback. `getAdminRecord()` returns role/name/flag; `requireAdmin()` is the page guard (redirects to `/admin/login`, or `/admin/definir-senha` when `must_change_password`).
- **Server actions are public endpoints** — every action (`admin/actions.ts`, `admin/auth-actions.ts`, `admin/equipe/actions.ts`) re-checks authorization server-side; never trust the UI. Owner-only actions (add/remove admin) check `role === "owner"` and never demote/remove an owner. `changePassword` clears `must_change_password` ONLY after a real password update — do NOT reintroduce a standalone "clear flag" action (it lets a first-access admin skip the mandatory change).
- **First-access flow**: `/admin/login` is email-first — `checkAdminEmail` says if it's a first-access admin → inline "set new password"; else normal password. Admins created in `/admin/equipe` start with `must_change_password = true`. Forgot-password → `resetPasswordForEmail` → `/auth/callback` (code exchange, anti open-redirect) → `/admin/definir-senha`. **Email delivery needs SMTP (Resend) configured in Supabase Auth.**
- **Login navigation gotcha**: after a client `signInWithPassword`, navigate with a **full page load** (`window.location.assign("/admin")`), NOT `router.replace` — a client transition can render `/admin` before the server sees the just-set session cookie, which bounces/hangs the login. `recordLogin()` (audit) is fire-and-forget so it never blocks the redirect.
- **Pages**: `/admin` (products), `/admin/produtos/novo` + `/admin/produtos/[id]` (CRUD), `/admin/logs` (audit), `/admin/equipe` (manage admins — add/remove owner-only), `/admin/conta` (own name/password).
- **Audit log** (migration `0003`): `public.audit_log` + `logAudit()` (`src/lib/audit.ts`) called after each admin mutation — who/what/when/IP. The human actor is only known in the Next layer (writes use service_role, which carries no user JWT). Read via `src/lib/audit-queries.ts` (service_role, guarded by `requireAdmin`).
- **Product writes** use the service_role admin client; `src/lib/admin-products.ts` reads all products (incl. inactive). Conventions: `ensureProductContent()` (ERP products may lack a content row), `parsePrice()` accepts pt-BR (`1.299,90`), images → public `product-images` bucket. Client forms use `useActionState` + toast (`src/components/toast.tsx`) + `SubmitButton` (`useFormStatus`).
- **Image uploads go DIRECT browser → Storage**, never through a Server Action body (Next caps it at 1 MB, Vercel at 4.5 MB — multiple phone photos blow past both and crash the page). Flow (`src/lib/upload-photos.ts`): `createUploadUrlsAction` (admin-gated) mints **signed upload URLs**, the browser `uploadToSignedUrl`s each file, then `commitPhotosAction` (add-photos) / `createProductAction` (new product, hidden `imagePath`) appends to `gallery` — the server rebuilds the public URL from the path, never trusting a client URL. These two forms are hand-rolled `onSubmit` (not `useActionState`/`SubmitButton`) because the upload must run before the mutation. No Storage RLS policy needed (signed URLs self-authorize).
- **Customer accounts** (signup/login, `/conta`, purchase history) are **not built yet** — that's the next step; it needs orders persisted at checkout (currently WhatsApp-only) and SMTP for email confirmation.

## Environment

`.env.example` is the source of truth (committed); `.env.local` is gitignored. Site needs `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`; admin writes need `SUPABASE_SERVICE_ROLE_KEY` + `ADMIN_EMAILS`. Supabase project ref: `anlbavcstwffnpisacax` (region sa-east-1) — `next.config.ts` `images.remotePatterns` is pinned to that host, update it if the project changes.

## Schema changes

Add SQL migrations under `supabase/migrations/`, apply them via the Supabase MCP (`apply_migration`) or the SQL editor, and keep repo migrations in sync with the live DB. Regenerate `src/lib/supabase/database.types.ts` after schema changes. Test data is in `supabase/seed.sql` (prefixed `seed-`; remove with `delete from public.products where microvix_id like 'seed-%'`).

## Deploy

Pushing to `main` triggers a Vercel production deploy (https://uzzo-store.vercel.app); the same env vars must be set in Vercel → Production. The repo owner sometimes commits from a separate checkout — **`git fetch` before pushing** and reconcile by merge/rebase; never force-push.
