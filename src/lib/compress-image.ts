/** Maior lado da foto salva. Acima disso nenhuma tela da loja aproveita. */
const MAX_LADO = 1600;
const QUALIDADE = 0.82;
/** Abaixo disso não vale recomprimir (o ganho é pequeno e pode piorar). */
const MINIMO_BYTES = 300 * 1024;

/**
 * Formatos aceitos no envio — e o `accept` dos seletores de arquivo.
 *
 * A compressão roda no canvas do navegador, que só converte o que ele consegue
 * decodificar. HEIC (padrão do iPhone) não decodifica no Chrome/Firefox, e
 * GIF/SVG não sobrevivem ao canvas: os três caíam no fallback e subiam com o
 * tamanho ORIGINAL. Era um furo silencioso justamente no caminho que estourou o
 * egress. Barrar na origem, com mensagem clara, é melhor do que aceitar e
 * engordar o Storage sem ninguém perceber — ainda mais porque HEIC nem aparece
 * na maioria dos navegadores, então subiria pesado E quebrado.
 */
export const FORMATOS_ACEITOS = "image/jpeg,image/png,image/webp";
const TIPOS_ACEITOS = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Teto por arquivo. Acima disso é engano (RAW, print gigante, vídeo). */
export const TAMANHO_MAXIMO_BYTES = 25 * 1024 * 1024;

export type CompressStatus =
  /** Converteu e diminuiu. */
  | "reduzida"
  /** Já estava abaixo do piso — não valia mexer. */
  | "pequena"
  /** Converteu, mas não diminuiu: mantém o original. */
  | "sem-ganho"
  /** O navegador não conseguiu processar: sobe o original inteiro. */
  | "falha";

export type CompressResult = { file: File; status: CompressStatus };

export function formatoAceito(file: File): boolean {
  return TIPOS_ACEITOS.has(file.type);
}

/** Troca a extensão do nome, já que o conteúdo passou a ser JPEG. */
function comExtensaoJpg(nome: string): string {
  const base = nome.replace(/\.[^./\\]+$/, "");
  return `${base || "foto"}.jpg`;
}

/**
 * Reduz a foto NO NAVEGADOR antes de subir para o Storage.
 *
 * Motivo: as fotos vinham do celular com ~1,7 MB (algumas 5 MB). Cada vez que o
 * otimizador de imagem da Vercel precisa gerar uma variante ele baixa o
 * original do Supabase — e foi isso que estourou o egress. 1600px/JPEG q82
 * derruba para ~200 KB sem diferença visível nos tamanhos que a loja usa.
 * Mesmos números do `scripts/comprimir-fotos.mjs`, que tratou o acervo antigo.
 *
 * Nunca lança: comprimir é otimização e não pode impedir o cadastro. Mas o
 * `status` diz o que aconteceu — quem chama precisa poder AVISAR quando o
 * original subiu inteiro, senão o peso volta em silêncio.
 */
export async function compressImage(file: File): Promise<CompressResult> {
  if (file.size < MINIMO_BYTES) return { file, status: "pequena" };

  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(
      1,
      MAX_LADO / Math.max(bitmap.width, bitmap.height),
    );
    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return { file, status: "falha" };
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALIDADE),
    );
    if (!blob) return { file, status: "falha" };
    if (blob.size >= file.size) return { file, status: "sem-ganho" };

    return {
      file: new File([blob], comExtensaoJpg(file.name), {
        type: "image/jpeg",
        lastModified: file.lastModified,
      }),
      status: "reduzida",
    };
  } catch {
    return { file, status: "falha" };
  }
}
