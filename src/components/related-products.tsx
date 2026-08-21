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
  isAdmin = false,
  isLogged = false,
  favorites,
}: {
  categoryName: string | null;
  excludeId: string;
  /** Página atual — para o coração de favorito voltar para ONDE o cliente
   * estava (e não para a página do produto relacionado). */
  backTo: string;
  isAdmin?: boolean;
  isLogged?: boolean;
  favorites?: Set<string>;
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
      className="mt-16 border-t border-border pt-10"
    >
      <h2 className="mb-6 font-serif text-2xl font-semibold tracking-tight">
        Você também pode gostar
      </h2>
      <div className="scrollbar-hide -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto sm:overflow-visible px-6 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-6 sm:px-0 lg:grid-cols-4">
        {related.map((p) => (
          <div key={p.slug} className="min-w-[62%] snap-start sm:min-w-0">
            <ProductCard
              product={p}
              isAdmin={isAdmin}
              isLogged={isLogged}
              isFavorite={favorites?.has(p.id) ?? false}
              backTo={backTo}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
