# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar com o código deste repositório.

@AGENTS.md

> ⚠️ **Next.js 16** (App Router, React 19, Turbopack). As APIs diferem de versões antigas do Next — siga a nota do AGENTS.md acima e consulte `node_modules/next/dist/docs/` para qualquer coisa sensível à versão. Em especial: `params`/`searchParams` nas páginas são **Promises** (dê `await`); a convenção de interceptação de requisição é **`proxy.ts`**, NÃO `middleware.ts`.

## Comandos

Rode tudo a partir do diretório `UzzoStore/`.

- `npm run dev` — servidor de desenvolvimento (Turbopack), http://localhost:3000
- `npm run build` — **o portão de validação**: roda typecheck do TypeScript + ESLint + build de produção. **Não há suíte de testes**; rode `npm run build` para verificar que uma mudança compila e passa no typecheck antes de commitar.
- `npm run lint` — só o ESLint

Notas de Windows/ambiente: o CLI `gh` pode não estar no PATH da ferramenta Bash — chame pelo caminho completo (`C:\Program Files\GitHub CLI\gh.exe`). O repositório fica sob um caminho do **OneDrive** (a sincronização atrapalha o file-watching do dev do Turbopack; se o dev cair com erro de "Jest worker … exceeding retry limit", reinicie-o).

## O que é isto

E-commerce da **Uzzo Store** (moda masculina, Balneário Camboriú/SC). A justificativa de design, os detalhes de integração e o roadmap por fases estão em **`docs/ARQUITETURA.md`** — leia antes de mudanças grandes.

O ERP da loja, o **Linx Microvix, é a fonte de verdade *pretendida*** para produtos/estoque/preços, mas essa integração **ainda não foi construída** (o Microvix é só de polling; travado por falta de uma chave de acesso B2C). Até lá, produtos/preços/estoque são gerenciados **manualmente pelo admin**. O código é estruturado para o Microvix depois assumir as tabelas "espelho" sem retrabalhar a vitrine.

## Backend: Supabase (três clients — não misture)

- `src/lib/supabase/client.ts` — navegador, anon key. Client Components.
- `src/lib/supabase/server.ts` — servidor, anon key + cookies (com escopo de RLS). Server Components.
- `src/lib/supabase/admin.ts` — **service_role, ignora RLS, `server-only`**. Use APENAS dentro de server actions, e só depois de `getAdminUser()` passar.

A renovação de sessão roda em `src/proxy.ts` → `src/lib/supabase/middleware.ts` (`updateSession`).

## Modelo de dados (ver `supabase/migrations/20260725163425_0001_initial_schema.sql` e `..._0004_color_factor_global_colors_product_price.sql`)

Duas categorias de tabelas — essa divisão guia tudo:

- **Tabelas espelho** (`products`, `product_variants`, `stock_cache`, `prices`, `categories`): destinadas a serem donas do Microvix; a vitrine as trata como cache de leitura e não deve depender de editá-las pelo client.
- **Próprias do site** (`colors`, `product_colors`, `product_content` = slug/SEO, `customers`, `carts`, `cart_items`, `reservations`, `orders`, `order_items`, `payments`, `sync_state`).

Fatos-chave (atualizados na migração `0004` — a feature "Cor"):
- A **unidade vendável é a variante** (`product_variants`), que é uma **grade (cor × tamanho)**. Cada variante pertence a uma linha de **`product_colors`** via `product_color_id` (e mantém o texto livre `color` = o nome da cor, para compatibilidade com o espelho do Microvix). Índice único em `(product_color_id, coalesce(size,''))`.
- **`colors`** é um **cadastro global de cores** (próprio do site): `name` (único) + `hex` opcional (swatch). Nomes padronizados viabilizam filtrar por cor no catálogo.
- **`product_colors`** liga uma cor global a um produto e é dona da **`gallery`** daquela cor (array JSON de URLs do Storage). **As fotos são por cor**, não por produto.
- **O preço é GLOBAL por produto**: `products.price` + `products.promo_price`. Preço efetivo = `promo_price ?? price`. A tabela **`prices` (por variante) está DORMENTE** — mantida para o futuro caminho do Microvix, mas **não é mais lida pelo site**; não reintroduza preço por variante/cor na UI.
- **O estoque é por variante** (`stock_cache`), então o estoque é naturalmente por (cor, tamanho).
- `product_content.gallery` é **legado** (mantida, mas não lida pela vitrine/admin depois da `0004`). Um produto só aparece na vitrine quando `active_ecommerce = true`.

**RLS está ligado em toda tabela.** As tabelas de catálogo permitem `SELECT` público; as de cliente/pedido têm escopo por `auth.uid()`; `carts`/`order`/`payments`/`sync_*` **não têm policy de escrita de propósito** — só o service_role (server-side) grava nelas.

## Vitrine

Server Components buscam via `src/lib/products.ts` (`getProducts`, `getProductBySlug`). Os embeds aninhados do Supabase são convertidos em tipos `Row` locais via `as unknown as` — proposital, para evitar a inferência frágil dos tipos gerados em selects profundos. `getProductBySlug` devolve `colors` (cada uma com sua `gallery` + `variants` de tamanho) e o preço no nível do produto; `getProducts` devolve, por produto, a lista de `colors` (nome, `hex`, `images[]`) e o `id`.

A página do produto é dirigida por um único client component **`src/components/product-view.tsx`**: guarda a cor + tamanho selecionados, **troca a galeria e os tamanhos/estoque disponíveis quando a cor muda**, tem o seletor de **quantidade** (padrão 1, botões −/+, editável, mínimo 1) e é o único caminho de escrita no carrinho. No desktop, a coluna da imagem é **limitada em largura** (grid `md` 22rem / `lg` 26rem) para a foto não estourar a altura da tela; no mobile fica em largura total.

**Fotos e carrossel**: `src/components/slide-track.tsx` renderiza as fotos numa faixa que desliza via `translateX` (transição de 300ms) — usado no card e na página do produto; `src/components/carousel-arrows.tsx` são as setas laterais (aparecem quando a cor tem 2+ fotos e giram em loop). Passe uma `key` que muda ao trocar a cor, para o deslize não "atravessar" a galeria antiga.

**Card** (`src/components/product-card.tsx` + `card-color-media.tsx`): mostra as **bolinhas de cor** (swatches, pela `hex`) entre a foto e a categoria; clicar troca a foto para a daquela cor (cor sem foto → placeholder), com a cor selecionada destacada por um anel.

As categorias do menu/filtro vêm do **banco** (`getCategories`, tabela `categories` kind `setor`) — geridas em `/admin/categorias`; `src/lib/categories.ts` guarda só o helper puro `categorySlug`. A página `/produtos` filtra por **categoria** e por **cor** (multi-seleção) via query string (`?categoria=<slug>&cores=Nome1,Nome2`), tudo por `<Link>` (server-side; nenhuma cor selecionada = todas; clicar numa cor alterna a seleção). O carrinho é **client-side** (`src/lib/cart-store.ts`, Zustand + localStorage); o `CartItem` carrega `color` + `size` (a chave de dedupe continua sendo `variantId`, já que cada cor×tamanho é uma variante distinta). O checkout monta uma **mensagem de pedido no WhatsApp** (`/sacola`) que inclui a cor — ainda sem pagamento online.

## Admin (`/admin`) e papéis de auth

- **Os papéis vivem no banco** (migração `0003`): tabela `public.admins` (`role` owner|admin, `full_name`, `must_change_password`) + função SQL `is_admin()`. `getAdminUser` (`src/lib/admin.ts`) é um **portão duplo** — `is_admin()` é a fonte de verdade; a env `ADMIN_EMAILS` é só fallback de bootstrap. `getAdminRecord()` devolve papel/nome/flag; `requireAdmin()` é o guard de página (redireciona para `/admin/login`, ou `/admin/definir-senha` quando `must_change_password`).
- **Server actions são endpoints públicos** — toda action (`admin/actions.ts`, `admin/auth-actions.ts`, `admin/equipe/actions.ts`) re-verifica a autorização no servidor; nunca confie na UI. Ações só-owner (adicionar/remover admin) checam `role === "owner"` e nunca rebaixam/removem um owner. `changePassword` limpa `must_change_password` SOMENTE após uma troca real de senha — NÃO reintroduza uma action isolada de "limpar flag" (deixaria o admin de primeiro acesso pular a troca obrigatória).
- **Fluxo de primeiro acesso**: `/admin/login` é email-first — `checkAdminEmail` diz se é admin de primeiro acesso → "definir nova senha" inline; senão, senha normal. Admins criados em `/admin/equipe` começam com `must_change_password = true`. Esqueci a senha → `resetPasswordForEmail` → `/auth/callback` (troca de code, anti open-redirect) → `/admin/definir-senha`. **O envio de e-mail precisa de SMTP (Resend) configurado no Supabase Auth.**
- **Pegadinha de navegação no login**: depois de um `signInWithPassword` no client, navegue com **recarregamento completo** (`window.location.assign("/admin")`), NÃO `router.replace` — uma transição client pode renderizar `/admin` antes de o servidor ver o cookie de sessão recém-setado, o que trava/repica o login. `recordLogin()` (auditoria) é fire-and-forget para nunca bloquear o redirect.
- **Páginas**: `/admin` (produtos), `/admin/produtos/novo` + `/admin/produtos/[id]` (CRUD), `/admin/categorias` (**CRUD de categorias/setores** — `create/update/deleteCategoryAction`; excluir deixa os produtos sem categoria, FK `on delete set null`), `/admin/cores` (**cadastro global de cores** — criar/renomear/recolorir/excluir; cor em uso não pode ser excluída, FK `on delete restrict`), `/admin/logs` (auditoria), `/admin/equipe` (gerenciar admins — adicionar/remover só-owner), `/admin/conta` (próprio nome/senha).
- **Feature de Cor** (migração `0004`): a página de edição do produto é organizada **por cor** — cada linha de `product_colors` tem sua grade de fotos + uma grade de tamanho/estoque (`VariantForm`, tamanho + qtd, **sem preço**). Preço global + promo ficam no `ProductInfoForm`. Adicione uma cor via `addProductColorAction` (escolher de `colors` ou criar uma cor global na hora); remova via `removeProductColorAction` (cascateia variantes/estoque e apaga as fotos daquela cor no Storage). O formulário de novo produto (`createProductAction`) recebe nome/categoria/preço/promo/tamanhos + uma-ou-mais cores (`colorIds` existentes e/ou `newColors` por vírgula) e monta toda a grade cor×tamanho com estoque 0.
- **Atalhos de admin na vitrine**: `src/components/admin-product-overlay.tsx` sobrepõe, no canto superior direito da foto, uma **estrela** (liga/desliga o destaque na home via `toggleFeaturedAction`) e um **lápis** (link para `/admin/produtos/[id]`). Aparece para admin nos **cards** (`/produtos`), nos **destaques da home** e na **página do produto** — cada uma dessas páginas detecta admin via `getAdminUser` e passa `isAdmin`. A estrela é o client component `src/components/featured-star.tsx` (`useActionState` + toast; o toast tem variante de erro, vermelho). `revalidateProduct` também revalida `/produtos/[slug]` para a estrela refletir a troca na própria página do produto.
- **Log de auditoria** (migração `0003`): `public.audit_log` + `logAudit()` (`src/lib/audit.ts`) chamado após cada mutação de admin — quem/o quê/quando/IP. O ator humano só é conhecido na camada Next (as escritas usam service_role, que não carrega JWT de usuário). Leia via `src/lib/audit-queries.ts` (service_role, protegido por `requireAdmin`).
- **Escritas de produto** usam o client admin service_role; `src/lib/admin-products.ts` lê todos os produtos (inclusive inativos). Convenções: `ensureProductContent()` (produtos do ERP podem não ter linha de conteúdo), `parsePrice()` aceita pt-BR (`1.299,90`), imagens → bucket público `product-images`. Os formulários client usam `useActionState` + toast (`src/components/toast.tsx`) + `SubmitButton` (`useFormStatus`).
- **Uploads de imagem vão DIRETO navegador → Storage**, nunca pelo corpo de uma Server Action (o Next limita a 1 MB e a Vercel a 4,5 MB — várias fotos de celular estouram e derrubam a página). Fluxo (`src/lib/upload-photos.ts`): `createUploadUrlsAction` (protegida por admin) gera **URLs de upload assinadas** (pasta = o `product_colors.id`), o navegador faz `uploadToSignedUrl` de cada arquivo, e então `commitPhotosAction(productColorId, paths)` anexa à `product_colors.gallery` daquela cor — o servidor remonta a URL pública a partir do caminho, sem confiar em URL vinda do client. `AddPhotosForm` (por cor) é `onSubmit` na mão (não `useActionState`) porque o upload precisa rodar antes da mutação. `removePhotoAction` recebe `productColorId` + `url`. Não precisa de policy de RLS no Storage (URLs assinadas se autoautorizam). (O novo produto não sobe mais foto — as fotos são adicionadas por cor na tela de edição.)
- **Contas de cliente** (cadastro/login, `/conta`, histórico de compras) **ainda não foram construídas** — é o próximo passo; exige pedidos persistidos no checkout (hoje só WhatsApp) e SMTP para confirmação por e-mail.

## Ambiente

`.env.example` é a fonte de verdade (versionado); `.env.local` está no gitignore. O site precisa de `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`; as escritas de admin precisam de `SUPABASE_SERVICE_ROLE_KEY` + `ADMIN_EMAILS` (sem a service_role key, o `/admin` e as actions de escrita — inclusive a estrela de destaque — falham; localmente isso costuma faltar no `.env.local`). Ref do projeto Supabase: `anlbavcstwffnpisacax` (região sa-east-1) — o `images.remotePatterns` do `next.config.ts` está fixado nesse host; atualize se o projeto mudar.

## Mudanças de schema

Adicione migrações SQL em `supabase/migrations/`, aplique via MCP do Supabase (`apply_migration`) ou pelo SQL editor, e mantenha as migrações do repo em sincronia com o banco ao vivo. **O nome do arquivo importa:** `apply_migration` registra a migração na tabela remota `schema_migrations` com uma versão de timestamp de 14 dígitos gerada (ex.: `20260726153929`). O check "Preview" do Supabase no GitHub compara essa versão remota com a versão extraída dos dígitos iniciais de cada nome de arquivo local — então o arquivo local PRECISA ter esse timestamp exato como prefixo (`<timestamp>_<nome>.sql`, ex.: `20260726153929_0003_auth_roles_audit.sql`), ou o check falha com "Remote migration versions not found in local migrations directory". Regenere `src/lib/supabase/database.types.ts` após mudanças de schema. Os dados de teste ficam em `supabase/seed.sql` (prefixados com `seed-`; remova com `delete from public.products where microvix_id like 'seed-%'`).

## Deploy

Dar push na `main` dispara um deploy de produção na Vercel (produção em https://uzzostore.com.br; também https://uzzo-store.vercel.app); as mesmas env vars precisam estar em Vercel → Production. O dono do repo às vezes commita de um checkout separado — **`git fetch` antes de dar push** e reconcilie por merge/rebase; nunca force-push.
