import { getProducts, getCategories } from "@/lib/products";
import { ProductCard } from "@/components/product-card";

/**
 * "Você também pode gostar" — peças da MESMA categoria do produto aberto.
 *
 * Custo: `getCategories` e `getProducts` já passam por `unstable_cache`, e a
 * chave inclui os argumentos — ou seja, no máximo UMA consulta por categoria a
 * cada janela de cache, servida a todas as visitas. Nada é buscado por visita.
 *
 * No celular a fileira desliza na horizontal (snap); no desktop vira grade.
 */
export async function RelatedProducts({
  categoryName,
  excludeId,
  backTo,
}: {
  categoryName: string | null;
  excludeId: string;
  /** Página atual — para o coração de favorito voltar para ONDE o cliente
   * estava (e não para a página do produto relacionado). */
  backTo: string;
}) {
  if (!categoryName) return null;
  const categories = await getCategories();
  const cat = categories.find((c) => c.name === categoryName);
  if (!cat) return null;

  // 5 = 4 exibidos + 1 de folga caso o próprio produto venha na lista.
  const { items } = await getProducts({
    categoryIds: [cat.id],
    page: 1,
    perPage: 5,
  });
  const related = items.filter((p) => p.id !== excludeId).slice(0, 4);
  if (related.length === 0) return null;

  return (
    <section
      aria-label="Produtos relacionados"
      className="mt-12 border-t border-border pt-8 lg:mt-20 lg:pt-12"
    >
      <h2 className="mb-5 font-display text-xl font-bold lg:mb-7 lg:text-3xl">
        Você também pode gostar
      </h2>
      {/* `scroll-pl-6` casa com o `px-6` — sem ele o snap encosta o primeiro
          card na borda da tela (mesmo motivo comentado em app/page.tsx). */}
      <div className="scrollbar-hide bleed-x flex snap-x snap-mandatory gap-3 overflow-x-auto lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-x-5 lg:overflow-visible lg:px-0">
        {related.map((p) => (
          <div
            key={p.slug}
            className="w-[58%] shrink-0 snap-start sm:w-[36%] lg:w-auto"
          >
            <ProductCard product={p} backTo={backTo} />
          </div>
        ))}
      </div>
    </section>
  );
}
