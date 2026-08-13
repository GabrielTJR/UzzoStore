/** Maior lado da foto salva. Acima disso nenhuma tela da loja aproveita. */
const MAX_LADO = 1600;
const QUALIDADE = 0.82;
/** Abaixo disso não vale recomprimir (o ganho é pequeno e pode piorar). */
const MINIMO_BYTES = 300 * 1024;

/**
 * Reduz a foto NO NAVEGADOR antes de subir para o Storage.
 *
 * Motivo: as fotos vinham do celular com ~1,7 MB (algumas 5 MB). Cada vez que o
 * otimizador de imagem da Vercel precisa gerar uma variante ele baixa o
 * original do Supabase — e foi isso que estourou o egress. 1600px/JPEG q82
 * derruba para ~200 KB sem diferença visível nos tamanhos que a loja usa.
 *
 * Mantém JPEG (e o nome do arquivo) para não mexer na extensão gerada no
 * servidor. Se algo falhar, devolve o arquivo original — comprimir é otimização,
 * não pode impedir o cadastro.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // GIF animado e SVG não sobrevivem ao canvas.
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (file.size < MINIMO_BYTES) return file;

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
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALIDADE),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
