import Image from "next/image";
import Link from "next/link";
import { ProductPlaceholder } from "@/components/product-placeholder";
import { categorySlug } from "@/lib/categories";
import { DEPARTMENTS, type Department } from "@/lib/departments";
import type { CategoryCover, CategoryCoversByDepartment } from "@/lib/products";

/**
 * Atalhos de categoria da home: fileira que desliza no celular, grade no
 * desktop. Fica num arquivo próprio (e não dentro de `page.tsx`) para a rota de
 * prévia conseguir renderizá-lo com dados de exemplo.
 *
 * Por departamento: enquanto só o Masculino tem peças, é UMA fileira sem
 * título — exatamente a home de antes. Quando o Feminino tiver peças, vira uma
 * fileira por departamento, cada uma com o nome dele e "Ver tudo". Duas
 * fileiras em vez de abas de propósito: aba precisa de JS (ou de truque de
 * CSS) e esconde metade dos atalhos atrás de um toque; fileira é HTML puro e
 * deixa as duas seções à vista no mesmo rolar.
 *
 * Links em ENDEREÇO LIMPO (`/masculino/polos`, `/feminino/blusas`), nunca
 * `/produtos?categorias=…` — essa é faceta e o Firewall da Vercel a desafia.
 */
export function CategoryStrip({
  covers,
}: {
  covers: CategoryCoversByDepartment;
}) {
  const grupos = (Object.keys(DEPARTMENTS) as Department[]).filter(
    (d) => covers[d].length > 0,
  );
  if (grupos.length === 0) return null;
  const comTitulo = grupos.length > 1;
  // No desktop as fileiras dividem o MESMO número de colunas (o da maior):
  // com colunas automáticas, 5 categorias femininas sob 9 masculinas viravam
  // capas quase duas vezes maiores. Com uma fileira só, dá o mesmo de antes.
  const colunas = Math.max(...grupos.map((d) => covers[d].length));

  return (
    <section
      aria-label="Categorias"
      className="px-page space-y-8 py-8 lg:space-y-10 lg:py-12"
    >
      {grupos.map((dep) => (
        <div key={dep}>
          {comTitulo && (
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="font-display text-lg font-bold lg:text-2xl">
                {DEPARTMENTS[dep]}
              </h2>
              <Link
                href={`/${dep}`}
                className="text-sm underline underline-offset-4"
              >
                Ver tudo
              </Link>
            </div>
          )}
          <Fileira dep={dep} categories={covers[dep]} colunas={colunas} />
        </div>
      ))}
    </section>
  );
}

function Fileira({
  dep,
  categories,
  colunas,
}: {
  dep: Department;
  categories: CategoryCover[];
  colunas: number;
}) {
  return (
    <ul
      style={{ "--cols": colunas } as React.CSSProperties}
      className="scrollbar-hide bleed-x flex snap-x snap-mandatory gap-3 overflow-x-auto lg:mx-0 lg:grid lg:grid-cols-[repeat(var(--cols),minmax(0,1fr))] lg:gap-4 lg:overflow-visible lg:px-0"
    >
      {categories.map((c) => (
        <li key={c.id} className="w-[27%] shrink-0 snap-start sm:w-32 lg:w-auto">
          {/* Sem prefetch: são vários atalhos, e baixar todos ao aparecerem na
              tela seria trabalho por visita sem clique. */}
          <Link
            href={`/${dep}/${categorySlug(c.name)}`}
            prefetch={false}
            className="group block"
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded-xs bg-surface">
              {c.image ? (
                <Image
                  src={c.image}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 128px, 200px"
                  className="object-cover"
                />
              ) : (
                <ProductPlaceholder />
              )}
            </div>
            <p className="mt-2 text-[0.8rem] font-semibold underline-offset-4 group-hover:underline lg:text-sm">
              {c.name}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
