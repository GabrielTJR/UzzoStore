/**
 * Placeholder de imagem enquanto os produtos não têm foto cadastrada.
 * Substituído pela imagem real (Supabase Storage) quando a galeria for preenchida.
 */
export function ProductPlaceholder() {
  return (
    <div className="flex aspect-[3/4] w-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800">
      <span className="flex items-baseline gap-1 opacity-40">
        <span className="font-serif text-xl font-semibold tracking-tight">
          UZZO
        </span>
        <span className="text-[0.5rem] font-medium uppercase tracking-[0.35em]">
          Store
        </span>
      </span>
    </div>
  );
}
