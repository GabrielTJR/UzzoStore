import Link from "next/link";
import { BenefitsStrip } from "@/components/benefits-strip";
import { CategoryStrip } from "@/components/category-strip";
import { HomeHero } from "@/components/home-hero";
import { ProductCard } from "@/components/product-card";
import { aplicaAtalhos } from "@/lib/home-config";
import { getHomeConfig } from "@/lib/home-config-server";
import { FABRIC_CLAIMS } from "@/lib/home-hero";
import {
  getCategoryCovers,
  getProducts,
  hasDepartmentProducts,
  type ProductListItem,
} from "@/lib/products";
import { shippingConfigured } from "@/lib/shipping";

/**
 * HOME — base fixa (out/2026).
 *
 * A decoração em blocos (`home_sections`, hoje em /admin/decoracao/blocos, sem
 * link no menu) está DESLIGADA por
 * decisão do dono enquanto a base nova assenta: esta página não lê os blocos
 * (ver `HOME_DECORATIONS_ENABLED` em lib/home-sections.ts). Nada foi apagado
 * do banco; religar é voltar a renderizar os blocos aqui, no visual novo.
 *
 * Ordem pensada para o celular, que é de onde vem quase todo mundo: hero →
 * atalhos de categoria → peças → por que o tecido importa → ofertas → o resto.
 * A roupa aparece antes do argumento.
 *
 * O hero, os atalhos de categoria (e, no layout, a faixa de avisos) vêm da
 * PÁGINA INICIAL publicada no painel (/admin/decoracao, `lib/home-config.ts`).
 * Sem nada publicado — ou sem a migração 0023 —, valem os de antes.
 *
 * Custo: 6 leituras, todas no cache persistente (`unstable_cache`), nenhuma por
 * visita — destaques, ofertas, capas de categoria, "tem feminino?", a página
 * inicial publicada e, só para quem está logado, os favoritos.
 */

/**
 * Vitrine: no celular, fileira que desliza com o dedo (mostra 8 peças sem
 * empilhar uma página quilométrica); no desktop, UMA fileira — 4 peças, 5 em
 * tela larga. As excedentes somem com CSS, sem consulta diferente por tela.
 */
function ProductRow({
  title,
  href,
  products,
}: {
  title: string;
  href: string;
  products: ProductListItem[];
}) {
  if (products.length === 0) return null;
  return (
    <section className="px-page py-8 lg:py-12">
      <div className="mb-5 flex items-baseline justify-between gap-4 lg:mb-7">
        <h2 className="font-display text-xl font-bold lg:text-3xl">{title}</h2>
        <Link href={href} className="text-sm underline underline-offset-4">
          Ver tudo
        </Link>
      </div>
      <div className="scrollbar-hide bleed-x flex snap-x snap-mandatory gap-3 overflow-x-auto lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-x-5 lg:overflow-visible lg:px-0 2xl:grid-cols-5">
        {products.map((p, i) => (
          <div
            key={p.slug}
            className={`w-[58%] shrink-0 snap-start sm:w-[36%] lg:w-auto ${
              i >= 5 ? "lg:hidden" : i === 4 ? "lg:hidden 2xl:block" : ""
            }`}
          >
            <ProductCard product={p} backTo="/" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** O argumento da marca: o que o tecido faz. Faixa preta, lista de definições. */
function FabricBand() {
  return (
    <section className="bg-foreground text-background">
      <div className="px-page grid gap-8 py-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-20">
        <div>
          <h2 className="font-display max-w-[14ch] text-[1.75rem] font-extrabold leading-[1.05] lg:text-5xl">
            O tecido faz o trabalho.
          </h2>
          <p className="mt-4 max-w-[38ch] text-[0.95rem] leading-relaxed opacity-70 lg:text-base">
            Poliamida, Sorona e malhas tecnológicas escolhidas para o dia
            inteiro: do escritório ao jantar, sem pensar na roupa.
          </p>
        </div>
        <dl className="grid sm:grid-cols-2 sm:gap-x-10">
          {FABRIC_CLAIMS.map((c) => (
            <div
              key={c.title}
              className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 border-t border-background/25 py-5"
            >
              {/* O mesmo ponto das etiquetas do hero: a faixa continua a frase
                  que a foto começou. */}
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full bg-[#1f45e0] ring-2 ring-background"
              />
              <dt className="font-display text-lg font-bold">{c.title}</dt>
              <dd className="col-start-2 mt-1 text-sm leading-snug opacity-70">
                {c.text}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** Feminino ainda sem peças: avisa que vem e leva para a página de aviso. */
function FemininoTeaser() {
  return (
    <section className="px-page py-10 lg:py-16">
      <div className="grid gap-5 border-y border-foreground py-8 lg:grid-cols-[1fr_auto] lg:items-center lg:py-12">
        <div>
          <h2 className="font-display text-2xl font-extrabold lg:text-4xl">
            Feminino chega em breve.
          </h2>
          <p className="mt-2 max-w-[46ch] text-[0.95rem] text-muted">
            A mesma tecnologia de tecido, agora também para elas. Deixe seu
            e-mail e saiba primeiro quando a coleção entrar.
          </p>
        </div>
        <Link
          href="/feminino"
          className="flex h-13 items-center justify-center rounded-xs border-[1.5px] border-foreground px-8 text-[0.95rem] font-semibold"
        >
          Quero ser avisada
        </Link>
      </div>
    </section>
  );
}

/**
 * Estática (guardada pronta), derrubada pelas etiquetas de cache das mutações
 * (`CACHE_TAGS`): nada aqui depende de quem está olhando — logado, admin e
 * favoritos se acertam no navegador (`lib/viewer.ts`). A janela de 5 min é o
 * teto para o que nenhuma mutação avisa (a expiração de reserva pelo pg_cron).
 */
export const revalidate = 300;

export default async function Home() {
  const [covers, temFeminino, destaques, ofertas, home] = await Promise.all([
    getCategoryCovers(),
    hasDepartmentProducts("feminino"),
    getProducts({ featured: true, page: 1, perPage: 8 }),
    getProducts({ onlyPromo: true, sort: "promocao", page: 1, perPage: 8 }),
    getHomeConfig(),
  ]);
  const freteAtivo = shippingConfigured();

  return (
    <>
      <HomeHero hero={home.hero} temFeminino={temFeminino} />
      <CategoryStrip covers={aplicaAtalhos(covers, home.atalhos)} />
      <ProductRow
        title="Destaques"
        href="/masculino"
        products={destaques.items}
      />
      <FabricBand />
      <ProductRow title="Ofertas" href="/ofertas" products={ofertas.items} />
      {!temFeminino && <FemininoTeaser />}
      <BenefitsStrip freteAtivo={freteAtivo} />
    </>
  );
}
