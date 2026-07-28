import Image from "next/image";

/**
 * Imagem provisória para produto/cor sem foto cadastrada: a logo da loja
 * centralizada sobre um fundo neutro. Preenche o container (que define a
 * proporção). A logo é escura por padrão, então invertemos no tema escuro.
 */
export function ProductPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 p-6 dark:from-zinc-900 dark:to-zinc-800">
      <Image
        src="/logo.png"
        alt="Uzzo Store"
        width={1815}
        height={524}
        sizes="(max-width: 640px) 45vw, 200px"
        className="h-auto w-1/2 max-w-[180px] opacity-40 dark:opacity-50 dark:invert"
      />
    </div>
  );
}
