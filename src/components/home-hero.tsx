import Image from "next/image";
import Link from "next/link";
import type { HeroConfig } from "@/lib/home-config";
import { displayProductName } from "@/lib/product-name";

/**
 * Hero "Etiqueta": a foto mostra a roupa e as etiquetas dizem o que o tecido
 * faz — o diferencial da loja visto, não só escrito.
 *
 * - Celular: foto de borda a borda (4:5) e, logo abaixo, título e botões — os
 *   botões cabem na primeira tela de um aparelho de 812px de altura.
 * - Desktop: texto à esquerda, foto encostada na borda direita, do tamanho da
 *   altura visível.
 *
 * A moldura da foto é 4:5 nos DOIS casos: as etiquetas são posicionadas em
 * porcentagem dela, e mudar a proporção por breakpoint tiraria os pontos de
 * cima da roupa.
 *
 * Zero JS: a entrada das etiquetas é CSS (`.etiqueta-*` em globals.css), roda
 * uma vez e respeita `prefers-reduced-motion`.
 *
 * Custo: UMA imagem, com `priority` (é o LCP da home) e `sizes` casando com os
 * `deviceSizes` do next.config — o otimizador guarda cada variante por 31 dias.
 *
 * O conteúdo vem da configuração PUBLICADA da página inicial (editor do painel,
 * `lib/home-config.ts`); sem nada publicado, valem os de `lib/home-hero.ts`. O
 * mesmo componente roda na prévia do editor, alimentado pelo rascunho.
 */
export function HomeHero({
  hero,
  temFeminino,
}: {
  hero: HeroConfig;
  temFeminino: boolean;
}) {
  const botao =
    "flex h-13 items-center justify-center rounded-xs border-[1.5px] border-foreground px-6 text-[0.95rem] font-semibold";

  return (
    <section className="lg:grid lg:h-[clamp(35rem,calc(100svh-var(--header-h)-2.25rem),54rem)] lg:grid-cols-[minmax(0,1fr)_auto]">
      {/* Foto + etiquetas */}
      <HeroPhoto hero={hero} className="lg:order-2 lg:h-full" />

      {/* Texto */}
      <div className="px-page flex flex-col justify-end pb-8 pt-6 lg:order-1 lg:pb-14">
        <h1 className="font-display max-w-[12ch] text-[2rem] font-extrabold leading-[1.02] sm:text-5xl lg:text-6xl lg:leading-[0.98] xl:text-7xl 2xl:text-[5.5rem]">
          {hero.title}
        </h1>
        {hero.text && (
          <p className="mt-3 max-w-[34ch] text-[0.95rem] leading-snug text-muted lg:mt-6 lg:text-lg">
            {hero.text}
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2 lg:mt-9 lg:flex lg:gap-3">
          <Link
            href="/masculino"
            className={`${botao} bg-foreground text-background lg:min-w-48`}
          >
            Ver masculino
          </Link>
          {temFeminino ? (
            <Link href="/feminino" className={`${botao} lg:min-w-48`}>
              Ver feminino
            </Link>
          ) : (
            <Link href="/ofertas" className={`${botao} lg:min-w-48`}>
              Ver ofertas
            </Link>
          )}
        </div>
        {hero.look && (
          <p className="mt-4 text-xs text-muted lg:mt-6 lg:text-sm">
            Na foto:{" "}
            <Link
              href={`/produtos/${hero.look.slug}`}
              className="text-foreground underline underline-offset-4"
            >
              {displayProductName(hero.look.name)}
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * A moldura 4:5 com a foto e as etiquetas. Exportada à parte porque o editor do
 * painel usa a MESMA moldura para o dono clicar e posicionar os pontos — uma
 * cópia do desenho ali divergiria da loja no primeiro ajuste.
 */
export function HeroPhoto({
  hero,
  className = "",
  priority = true,
  sizes = "(max-width: 1024px) 100vw, 50vw",
  children,
}: {
  hero: HeroConfig;
  /** Classes de encaixe conforme o lugar (na home: ordem e altura no desktop). */
  className?: string;
  priority?: boolean;
  sizes?: string;
  /** Camada extra por cima (o editor desenha o realce do ponto selecionado). */
  children?: React.ReactNode;
}) {
  return (
    <div className={`relative aspect-[4/5] overflow-hidden bg-surface ${className}`}>
      <Image
        src={hero.image}
        alt={hero.alt}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover"
        style={{ objectPosition: `50% ${hero.focoY}%` }}
      />
      {/* O viewBox tem a MESMA proporção da moldura (100×125 = 4:5), então
          x é porcentagem direta e y é porcentagem × 1,25. Nada de
          `preserveAspectRatio="none"` + `non-scaling-stroke`: nessa
          combinação o Chrome ignora o `pathLength` e a linha sai tracejada
          em vez de se desenhar. */}
      <svg
        viewBox="0 0 100 125"
        aria-hidden
        className="absolute inset-0 h-full w-full"
      >
        {hero.tags.map((t, i) => (
          <path
            key={`${i}-${t.label}`}
            d={`M${t.x} ${t.y * 1.25} L${t.tx} ${t.ty * 1.25}`}
            pathLength={1}
            fill="none"
            stroke="#fff"
            strokeWidth="0.4"
            strokeLinecap="round"
            className="etiqueta-linha"
            style={{ "--d": `${0.4 + i * 0.4}s` } as React.CSSProperties}
          />
        ))}
      </svg>
      {/* As etiquetas são conteúdo (lista), não enfeite: o leitor de tela
          anuncia as propriedades do tecido. */}
      {hero.tags.length > 0 && (
        <ul aria-label="O que o tecido faz">
          {hero.tags.map((t, i) => {
            const d = { "--d": `${0.4 + i * 0.4}s` } as React.CSSProperties;
            return (
              <li key={`${i}-${t.label}`}>
                <span
                  aria-hidden
                  className="etiqueta-ponto absolute -ml-[5px] -mt-[5px] h-2.5 w-2.5 rounded-full bg-[#1f45e0] ring-[2.5px] ring-white"
                  style={{ left: `${t.x}%`, top: `${t.y}%`, ...d }}
                />
                <span
                  className="etiqueta-rotulo absolute whitespace-nowrap rounded-xs bg-white px-2.5 py-1.5 text-[0.72rem] font-semibold leading-none text-black lg:text-[0.8rem]"
                  style={{ ...t.rotulo, ...d }}
                >
                  {t.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {children}
    </div>
  );
}
