import { getImageProps } from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { HeroConfig, PosEtiqueta } from "@/lib/home-config";
import { displayProductName } from "@/lib/product-name";

/**
 * Hero de TELA INTEIRA (out/2026, direção "B" escolhida pelo dono): a foto
 * cobre a área toda nos dois formatos, um pano preto com a marca fica 1 s e
 * sobe, o título entra em caixa alta palavra por palavra e uma barra cobalto
 * se desenha. Etiquetas (o que o tecido faz) SÓ NO CELULAR, desde 07/10/2026
 * (decisão do dono): no computador a foto fica limpa. As posições são em % DA
 * FOTO (`home-hero.ts` explica) e andam junto com ela pelo `.hero-caixa`.
 *
 * - Celular: texto na parte de baixo, sobre um degradê.
 * - Computador: título grande embaixo à esquerda; texto e botões numa linha
 *   abaixo dele. Degradê da esquerda e de baixo, para o texto ler sobre
 *   qualquer foto.
 *
 * A foto é desenhada pelo `.hero-caixa` (globals.css): um object-cover feito
 * à mão, com o enquadramento de cada formato vindo do editor.
 *
 * Zero JS: tudo é CSS e roda uma vez; quem pede menos movimento no sistema vê
 * tudo parado e sem pano.
 *
 * Custo: UMA imagem por visita. Com foto própria para o computador, o
 * `<picture>` escolhe uma só pelo tamanho da tela — nunca baixa as duas.
 *
 * O conteúdo vem da configuração PUBLICADA (editor do painel); sem nada
 * publicado, valem os de `lib/home-hero.ts`. O editor usa este mesmo
 * componente na prévia, alimentado pelo rascunho.
 */
export function HomeHero({
  hero,
  temFeminino,
}: {
  hero: HeroConfig;
  temFeminino: boolean;
}) {
  const palavras = hero.title.split(/\s+/).filter(Boolean);
  // O título é em caixa alta e larga: a MAIOR palavra tem de caber numa
  // linha. A letra encolhe com ela (≈ 0,82 em por caractere na Archivo larga).
  const maior = Math.max(6, ...palavras.map((p) => p.length));
  const tituloVars = {
    "--t-cel": `min(10vw, calc(86vw / ${maior * 0.82}))`,
    "--t-pc": `min(7.5vw, calc(80vw / ${maior * 0.82}), 8rem)`,
  } as CSSProperties;

  // Atrasos (s): pano parado até 1,0 e subindo até 1,6; o título começa
  // quando o pano está quase fora; depois barra, texto e botões.
  const tPalavra = (i: number) => 1.35 + i * 0.09;
  const fimTitulo = tPalavra(palavras.length - 1) + 0.4;
  const atraso = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;
  const ratioPc = hero.fotoPc?.ratio ?? hero.ratio;
  const tagsCel = hero.tags.flatMap((t) =>
    t.cel ? [{ label: t.label, pos: t.cel }] : [],
  );

  const botao =
    "flex h-12 items-center justify-center rounded-xs border-[1.5px] border-white px-6 text-[0.95rem] font-semibold";

  return (
    <section className="relative h-[calc(100svh-var(--header-h)-2.25rem)] min-h-[32rem] overflow-hidden bg-black text-white lg:max-h-[62rem] lg:min-h-[36rem]">
      <div className="absolute inset-0" style={{ containerType: "size" }}>
        <div
          className="hero-caixa"
          style={
            {
              "--r-cel": hero.ratio,
              "--fx-cel": hero.focoCel.fx / 100,
              "--fy-cel": hero.focoCel.fy / 100,
              "--r-pc": ratioPc,
              "--fx-pc": hero.focoPc.fx / 100,
              "--fy-pc": hero.focoPc.fy / 100,
            } as CSSProperties
          }
        >
          <HeroImagem hero={hero} />
          {tagsCel.length > 0 && (
            <EtiquetasDaFoto
              tags={tagsCel}
              ratio={hero.ratio}
              atraso={fimTitulo + 0.3}
              className="lg:hidden"
            />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent lg:from-black/80 lg:via-black/10" />
        <div className="absolute inset-0 hidden bg-gradient-to-r from-black/45 via-transparent to-transparent lg:block" />
      </div>

      <div className="px-page absolute inset-x-0 bottom-0 pb-8 lg:pb-14">
        <h1
          className="font-display text-[length:var(--t-cel)] font-extrabold uppercase leading-[0.92] tracking-tight lg:max-w-[85%] lg:text-[length:var(--t-pc)]"
          style={tituloVars}
        >
          {palavras.map((p, i) => (
            <span key={i}>
              <span className="hero-palavra" style={atraso(tPalavra(i))}>
                {p}
              </span>{" "}
            </span>
          ))}
        </h1>
        <div
          className="hero-barra mt-4 h-1 w-24 bg-accent lg:w-40"
          style={atraso(fimTitulo)}
        />
        <div className="lg:mt-2 lg:flex lg:items-end lg:justify-between lg:gap-10">
          <div>
            {hero.text && (
              <p
                className="hero-surge mt-4 max-w-[38ch] text-[0.95rem] leading-snug text-white/85 lg:text-lg"
                style={atraso(fimTitulo + 0.1)}
              >
                {hero.text}
              </p>
            )}
            {hero.look && (
              <p
                className="hero-surge mt-3 hidden text-sm text-white/70 lg:block"
                style={atraso(fimTitulo + 0.35)}
              >
                Na foto:{" "}
                <Link
                  href={`/produtos/${hero.look.slug}`}
                  className="text-white underline underline-offset-4"
                >
                  {displayProductName(hero.look.name)}
                </Link>
              </p>
            )}
          </div>
          <div
            className="hero-surge mt-5 grid shrink-0 grid-cols-2 gap-2 lg:mt-0 lg:flex lg:gap-3"
            style={atraso(fimTitulo + 0.25)}
          >
            <Link
              href="/masculino"
              className={`${botao} bg-white text-black lg:min-w-48`}
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
        </div>
        {hero.look && (
          <p
            className="hero-surge mt-4 text-xs text-white/70 lg:hidden"
            style={atraso(fimTitulo + 0.35)}
          >
            Na foto:{" "}
            <Link
              href={`/produtos/${hero.look.slug}`}
              className="text-white underline underline-offset-4"
            >
              {displayProductName(hero.look.name)}
            </Link>
          </p>
        )}
      </div>

      {/* O pano: a marca por 1 s, depois sai de cena. */}
      <div
        aria-hidden
        className="hero-cortina pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black"
      >
        <span className="font-display text-2xl font-extrabold tracking-[0.2em]">
          UZZO
        </span>
      </div>
    </section>
  );
}

/**
 * A imagem do hero. Com foto própria para o computador, um `<picture>`
 * escolhe UMA pelo tamanho da tela (o navegador não baixa a outra). No
 * celular a caixa pode ser mais larga que a tela (a foto corta dos lados),
 * por isso o `sizes` de 150vw.
 */
function HeroImagem({ hero }: { hero: HeroConfig }) {
  const comum = {
    fill: true,
    fetchPriority: "high" as const,
    loading: "eager" as const,
    className: "object-cover",
  };
  const { props: cel } = getImageProps({
    ...comum,
    src: hero.image,
    alt: hero.alt,
    sizes: "(min-width: 1024px) 100vw, 150vw",
  });
  if (!hero.fotoPc) {
    // eslint-disable-next-line jsx-a11y/alt-text -- o alt vem nas props
    return <img {...cel} />;
  }
  const {
    props: { srcSet: srcSetPc },
  } = getImageProps({
    ...comum,
    src: hero.fotoPc.image,
    alt: hero.fotoPc.alt || hero.alt,
    sizes: "100vw",
  });
  return (
    <picture>
      <source media="(min-width: 1024px)" srcSet={srcSetPc} sizes="100vw" />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- o alt vem nas props */}
      <img {...cel} />
    </picture>
  );
}

/**
 * Pontos, linhas e rótulos sobre a foto — em % DA FOTO. Exportado porque o
 * editor do painel desenha as MESMAS etiquetas na tela de posicionar: uma
 * cópia do desenho ali divergiria da loja no primeiro ajuste.
 */
export function EtiquetasDaFoto({
  tags,
  ratio,
  atraso = 0,
  animar = true,
  className = "",
}: {
  tags: { label: string; pos: PosEtiqueta }[];
  ratio: number;
  atraso?: number;
  animar?: boolean;
  className?: string;
}) {
  const alt = 100 / ratio;
  const d = (i: number) =>
    ({ "--d": `${atraso + i * 0.35}s` }) as CSSProperties;
  return (
    <div className={`absolute inset-0 ${className}`}>
      {/* viewBox com a MESMA proporção da foto: x é % direto; y vira % × (1/ratio).
          Nada de `preserveAspectRatio="none"` + `non-scaling-stroke`: nessa
          combinação o Chrome ignora o `pathLength` e a linha sai tracejada. */}
      <svg
        viewBox={`0 0 100 ${alt}`}
        aria-hidden
        className="absolute inset-0 h-full w-full"
      >
        {tags.map((t, i) => (
          <path
            key={`${i}-${t.label}`}
            d={`M${t.pos.x} ${(t.pos.y / 100) * alt} L${t.pos.lx} ${(t.pos.ly / 100) * alt}`}
            pathLength={1}
            fill="none"
            stroke="#fff"
            strokeWidth="0.35"
            strokeLinecap="round"
            className={animar ? "etiqueta-linha" : undefined}
            style={d(i)}
          />
        ))}
      </svg>
      {/* As etiquetas são conteúdo (lista), não enfeite: o leitor de tela
          anuncia as propriedades do tecido. */}
      <ul aria-label="O que o tecido faz">
        {tags.map((t, i) => (
          <li key={`${i}-${t.label}`}>
            <span
              aria-hidden
              className={`${animar ? "etiqueta-ponto" : ""} absolute -ml-[5px] -mt-[5px] h-2.5 w-2.5 rounded-full bg-[#1f45e0] ring-[2.5px] ring-white`}
              style={{ left: `${t.pos.x}%`, top: `${t.pos.y}%`, ...d(i) }}
            />
            <span
              className={`${animar ? "etiqueta-rotulo" : ""} absolute -translate-y-1/2 whitespace-nowrap rounded-xs bg-white px-2.5 py-1.5 text-[0.72rem] font-semibold leading-none text-black lg:text-[0.8rem]`}
              style={{
                top: `${t.pos.ly}%`,
                ...(t.pos.lado === "d"
                  ? { left: `${t.pos.lx}%` }
                  : { right: `${100 - t.pos.lx}%` }),
                ...d(i),
              }}
            >
              {t.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
