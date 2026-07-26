/**
 * Placeholder de imagem enquanto o produto não tem foto cadastrada.
 * Preenche o container (que define a proporção).
 */
export function ProductPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800">
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
