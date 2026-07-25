export default function Home() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-400">
        Em breve
      </p>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        A nova loja online da Uzzo Store
      </h1>
      <p className="mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
        Estamos construindo nossa loja virtual, integrada ao estoque da nossa
        loja física em Balneário Camboriú. Novidades chegando em breve.
      </p>
      <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm text-zinc-500 dark:border-white/10">
        🚧 Site em desenvolvimento · Fase 0 (fundação)
      </div>
    </section>
  );
}
