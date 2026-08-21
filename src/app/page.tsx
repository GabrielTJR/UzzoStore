import Link from "next/link";
import Image from "next/image";
import { getProducts, getHomeSections, getCategories } from "@/lib/products";
import { ProductCard } from "@/components/product-card";
import { HomeBanner } from "@/components/home-banner";
import { BenefitsStrip } from "@/components/benefits-strip";
import { ProductPlaceholder } from "@/components/product-placeholder";
import { getAdminUser } from "@/lib/admin";
import type { HomeSection } from "@/lib/home-sections";
import type { ProductListItem } from "@/lib/products";

/** Hero padrão — usado enquanto a decoração não tiver nenhum banner ativo. */
function DefaultHero() {
  return (
    <section className="mx-auto flex min-h-[68vh] w-full sm:w-[80%] flex-col justify-center px-6 py-20">
      <p className="text-xs font-medium uppercase tracking-[0.35em] text-muted">
        Moda masculina · Balneário Camboriú
      </p>
      <h1 className="mt-6 max-w-4xl font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
        Tecnologia aplicada ao vestir.
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
        Conforto, praticidade e elegância — com envio para todo o Brasil.
      </p>
      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Link
          href="/produtos"
          className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Ver produtos
        </Link>
        <a
          href="https://www.instagram.com/uzzostorebc/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 items-center justify-center rounded-full border border-border px-8 text-sm font-medium transition-colors hover:border-foreground"
        >
          @uzzostorebc
        </a>
      </div>
    </section>
  );
}

function ProductRow({
  title,
  products,
  isAdmin,
}: {
  title: string;
  products: ProductListItem[];
  isAdmin: boolean;
}) {
  if (products.length === 0) return null;
  return (
    <section className="mx-auto w-full sm:w-[80%] px-6 py-16">
      <div className="mb-8 flex items-end justify-between">
        <h2 className="font-serif text-3xl font-semibold tracking-tight">
          {title}
        </h2>
        <Link
          href="/produtos"
          className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          Ver todos
        </Link>
      </div>
      {/* Celular: fileira que desliza com o dedo (snap) — padrão das lojas
          modernas e mostra mais produtos sem empilhar uma página quilométrica.
          Desktop: grade. */}
      <div className="scrollbar-hide -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto sm:overflow-visible px-6 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-x-6 sm:gap-y-10 sm:px-0 lg:grid-cols-4">
        {products.map((p) => (
          <div key={p.slug} className="min-w-[62%] snap-start sm:min-w-0">
            <ProductCard product={p} isAdmin={isAdmin} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function Home() {
  const [sections, adminUser, categories] = await Promise.all([
    getHomeSections(),
    getAdminUser(),
    getCategories(),
  ]);
  const isAdmin = !!adminUser;
  const catById = new Map(categories.map((c) => [c.id, c]));

  // Os blocos "vitrine" precisam buscar produtos — resolve todos antes de render.
  const vitrines = sections.filter((s) => s.kind === "vitrine");
  const vitrineProducts = new Map<string, ProductListItem[]>();
  await Promise.all(
    vitrines.map(async (s) => {
      const limit = s.data.limit ?? 8;
      const src = s.data.source ?? "destaques";
      const { items } = await getProducts({
        featured: src === "destaques" ? true : undefined,
        onlyPromo: src === "promo" ? true : undefined,
        categoryIds:
          src === "categoria" && s.data.categoryId
            ? [s.data.categoryId]
            : undefined,
        page: 1,
        perPage: limit,
      });
      vitrineProducts.set(s.id, items);
    }),
  );

  const hasBanner = sections.some((s) => s.kind === "banner");
  // Conta vitrines que de fato TÊM produtos: um bloco configurado mas vazio
  // (categoria sem peças, nada em promoção) deixaria a home sem produto nenhum.
  const hasVitrine = [...vitrineProducts.values()].some((v) => v.length > 0);

  // Sem decoração configurada: mantém a home antiga (hero + destaques).
  let fallbackFeatured: ProductListItem[] = [];
  if (!hasVitrine) {
    const { items } = await getProducts({
      featured: true,
      page: 1,
      perPage: 8,
    });
    fallbackFeatured = items;
  }

  // A faixa de benefícios entra logo depois do 1º banner (ou do hero padrão):
  // é o "por que comprar aqui" na primeira dobra, como nas lojas grandes.
  const firstBannerId = sections.find((s) => s.kind === "banner")?.id;

  function renderSection(s: HomeSection, index: number) {
    if (s.kind === "banner") {
      // Banners seguidos ficavam colados. Os outros blocos já têm py-16, então
      // o respiro só é necessário entre banner e banner.
      const afterBanner = sections[index - 1]?.kind === "banner";
      return (
        <div key={s.id} className={afterBanner ? "mt-8 sm:mt-10" : undefined}>
          <HomeBanner slides={s.data.slides ?? []} />
          {s.id === firstBannerId && (
            <div className="mt-8 sm:mt-10">
              <BenefitsStrip />
            </div>
          )}
        </div>
      );
    }

    if (s.kind === "mosaico") {
      const cards = (s.data.cards ?? []).filter((c) => c.image || c.label);
      if (cards.length === 0) return null;
      return (
        <section key={s.id} className="mx-auto w-full sm:w-[80%] px-6 py-16">
          {s.data.title && (
            <h2 className="mb-8 font-serif text-3xl font-semibold tracking-tight">
              {s.data.title}
            </h2>
          )}
          <div
            className={`grid gap-4 ${
              cards.length >= 4
                ? "grid-cols-2 lg:grid-cols-4"
                : cards.length === 3
                  ? "grid-cols-1 sm:grid-cols-3"
                  : "grid-cols-1 sm:grid-cols-2"
            }`}
          >
            {cards.map((c, k) => (
              <Link
                key={`${s.id}-${k}`}
                href={c.href}
                className="group relative block aspect-[3/4] overflow-hidden rounded-lg border border-border"
              >
                {c.image ? (
                  <Image
                    src={c.image}
                    alt={c.label || "Coleção"}
                    fill
                    sizes="(max-width: 640px) 100vw, 25vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <ProductPlaceholder />
                )}
                {c.label && (
                  <>
                    <span
                      aria-hidden
                      className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"
                    />
                    <span className="absolute bottom-4 left-4 right-4 font-serif text-xl font-semibold text-white drop-shadow">
                      {c.label}
                    </span>
                  </>
                )}
              </Link>
            ))}
          </div>
        </section>
      );
    }

    if (s.kind === "vitrine") {
      const items = vitrineProducts.get(s.id) ?? [];
      const fallbackTitle =
        s.data.source === "promo"
          ? "Em promoção"
          : s.data.source === "categoria"
            ? (catById.get(s.data.categoryId ?? "")?.name ?? "Produtos")
            : "Destaques";
      return (
        <ProductRow
          key={s.id}
          title={s.data.title ?? fallbackTitle}
          products={items}
          isAdmin={isAdmin}
        />
      );
    }

    return null; // 'aviso' é renderizado no layout (acima do header)
  }

  return (
    <>
      {/* Com a decoração ativa não existe o hero (que trazia o h1): mantém um
          título acessível para leitor de tela e buscador. */}
      {hasBanner && (
        <h1 className="sr-only">
          Uzzo Store — moda masculina em Balneário Camboriú
        </h1>
      )}
      {!hasBanner && (
        <>
          <DefaultHero />
          <BenefitsStrip />
        </>
      )}
      {sections.map(renderSection)}
      {!hasVitrine && (
        <ProductRow
          title="Destaques"
          products={fallbackFeatured}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
}
