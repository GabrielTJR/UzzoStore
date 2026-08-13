import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { createUploadUrlsAction } from "@/app/admin/actions";

const BUCKET = "product-images";

export type UploadResult = { paths: string[]; failed: number };

/**
 * Envia as imagens DIRETO do navegador para o Storage do Supabase usando URLs
 * de upload assinadas geradas pelo servidor. Os bytes não passam pela Server
 * Action (que tem limite de corpo de 1 MB no Next / 4,5 MB na Vercel), então
 * não há mais teto de tamanho nem de quantidade de fotos.
 *
 * `folder` é a pasta no bucket (o id do produto, ou "pending" quando o produto
 * ainda não existe). Retorna os caminhos enviados com sucesso — quem chama
 * confirma no servidor via `commitPhotosAction` / `createProductAction`.
 */
export async function uploadPhotos(
  files: File[],
  folder: string,
): Promise<UploadResult> {
  if (files.length === 0) return { paths: [], failed: 0 };

  const res = await createUploadUrlsAction(
    files.map((f) => ({ name: f.name })),
    folder,
  );
  if (!res.ok || !res.targets) {
    throw new Error(res.error ?? "Falha ao preparar o envio das imagens.");
  }

  const supabase = createClient();
  const paths: string[] = [];
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const target = res.targets[i];
    // Comprime antes de subir: original de celular tem ~1,7 MB e cada busca do
    // otimizador de imagem baixa esse arquivo inteiro do Supabase (egress).
    const file = await compressImage(files[i]);
    const { error } = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(target.path, target.token, file, {
        contentType: file.type || "image/jpeg",
        // 1 ano: a URL contém um uuid, então trocar a foto gera outra URL —
        // nunca há "mesma URL, imagem diferente" para invalidar.
        cacheControl: "31536000",
      });
    if (error) {
      failed++;
      continue;
    }
    paths.push(target.path);
  }

  return { paths, failed };
}
