export default function Home() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl flex-col justify-center px-6 py-20">
      <p className="text-xs font-medium uppercase tracking-[0.35em] text-muted">
        Moda masculina · Em breve online
      </p>

      <h1 className="mt-6 max-w-4xl font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
        Tecnologia aplicada ao vestir.
      </h1>

      <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
        Conforto, praticidade e elegância. A loja online da Uzzo Store está
        chegando — com envio para todo o Brasil.
      </p>

      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
        <a
          href="https://www.instagram.com/uzzostorebc/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Ver novidades no Instagram
        </a>
        <span className="inline-flex h-12 items-center justify-center rounded-full border border-border px-8 text-sm font-medium text-muted">
          Comprar online — em breve
        </span>
      </div>

      <div className="mt-16 border-t border-border pt-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">
          Balneário Camboriú · Santa Catarina
        </p>
      </div>
    </section>
  );
}
