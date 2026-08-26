// Proporção real do arquivo public/logo.png (recortado ao conteúdo).
const LOGO_W = 1815;
const LOGO_H = 524;

/**
 * Logotipo da loja — NÃO é uma imagem, é uma MÁSCARA.
 *
 * O alfa de `/logo-mask.png` recorta a forma e a cor vem de `currentColor`
 * (regra `.logo-marca` em `globals.css`). O motivo é o "Locais escuros" do
 * Samsung Internet: ele recolore texto mas não mexe em `<img>`, então a logo em
 * PNG preto ficava preta sobre fundo preto — e como o navegador nem informa
 * `prefers-color-scheme: dark` nesse modo, um `dark:invert` também não salvava.
 * Sendo máscara, ela herda a mesma cor que o navegador acabou de clarear no
 * texto ao lado, no tema escuro de verdade e no forçado.
 *
 * ⚠️ Não volte a usar `<Image>` aqui. Foi assim que a marca ficou invisível.
 *
 * Vive em componente próprio (e não no layout) desde que o cabeçalho virou
 * client component para flutuar sobre o banner.
 */
export function Logo({
  height = 44,
  className = "",
}: {
  height?: number;
  /**
   * Para tamanho RESPONSIVO (ex.: `h-6 sm:h-[30px]`) — algo que a altura
   * numérica não faz. Quando a classe controla a altura, o `height` inline sai
   * do caminho: estilo inline venceria a classe e o breakpoint não funcionaria.
   * A largura sempre sai do `aspect-ratio`, então a proporção nunca distorce.
   */
  className?: string;
}) {
  const classeControlaAltura = /(^|\s|:)h-/.test(className);
  return (
    <span
      role="img"
      aria-label="Uzzo Store"
      className={`logo-marca inline-block shrink-0 ${className}`}
      style={{
        aspectRatio: `${LOGO_W} / ${LOGO_H}`,
        ...(classeControlaAltura ? {} : { height }),
      }}
    />
  );
}
