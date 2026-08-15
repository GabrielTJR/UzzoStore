import { createClient } from "@/lib/supabase/client";
import {
  compressImage,
  formatoAceito,
  TAMANHO_MAXIMO_BYTES,
} from "@/lib/compress-image";
import { createUploadUrlsAction } from "@/app/admin/actions";

const BUCKET = "product-images";

export type UploadResult = {
  paths: string[];
  /** Falharam no envio ao Storage. */
  failed: number;
  /** Recusados ANTES de subir (formato ou tamanho), com o motivo. */
  recusados: { name: string; motivo: string }[];
  /** Subiram com o tamanho original: o navegador não conseguiu comprimir. */
  semCompressao: string[];
};

/** Resumo legível dos recusados — os dois formulários mostram igual. */
export function resumoRecusados(
  recusados: { name: string; motivo: string }[],
): string {
  return recusados.map((r) => `${r.name} (${r.motivo})`).join("; ");
}

const MB = 1024 * 1024;

/**
 * Envia as imagens DIRETO do navegador para o Storage do Supabase usando URLs
 * de upload assinadas geradas pelo servidor. Os bytes não passam pela Server
 * Action (que tem limite de corpo de 1 MB no Next / 4,5 MB na Vercel), então
 * não há mais teto de tamanho nem de quantidade de fotos.
 *
 * `folder` é a pasta no bucket (o id da cor do produto, ou "home" para a
 * decoração). Retorna os caminhos enviados com sucesso — quem chama confirma no
 * servidor via `commitPhotosAction` / `createProductAction` — e mais o que foi
 * recusado ou subiu sem compressão, para o formulário poder avisar.
 */
export async function uploadPhotos(
  files: File[],
  folder: string,
): Promise<UploadResult> {
  const recusados: { name: string; motivo: string }[] = [];
  const semCompressao: string[] = [];
  const vazio: UploadResult = {
    paths: [],
    failed: 0,
    recusados,
    semCompressao,
  };
  if (files.length === 0) return vazio;

  // Comprime ANTES de pedir as URLs assinadas, por dois motivos: o caminho no
  // Storage nasce com a extensão do formato REAL (um .png que virou JPEG não
  // sobe mais com o nome mentindo), e um arquivo recusado não chega a gastar
  // uma URL assinada.
  const prontos: File[] = [];
  for (const original of files) {
    if (!formatoAceito(original)) {
      recusados.push({
        name: original.name,
        motivo: "formato não aceito — use JPG, PNG ou WebP",
      });
      continue;
    }
    if (original.size > TAMANHO_MAXIMO_BYTES) {
      recusados.push({
        name: original.name,
        motivo: `acima de ${Math.round(TAMANHO_MAXIMO_BYTES / MB)} MB`,
      });
      continue;
    }

    const { file, status } = await compressImage(original);
    // "pequena" e "sem-ganho" são desfechos normais. "falha" significa que o
    // arquivo inteiro vai para o Storage — quem cadastrou precisa saber, senão
    // o peso volta em silêncio (foi assim que o egress estourou sem aviso).
    if (status === "falha") semCompressao.push(original.name);
    prontos.push(file);
  }

  if (prontos.length === 0) return vazio;

  const res = await createUploadUrlsAction(
    prontos.map((f) => ({ name: f.name })),
    folder,
  );
  if (!res.ok || !res.targets) {
    throw new Error(res.error ?? "Falha ao preparar o envio das imagens.");
  }

  const supabase = createClient();
  const paths: string[] = [];
  let failed = 0;

  for (let i = 0; i < prontos.length; i++) {
    const target = res.targets[i];
    const file = prontos[i];
    if (!target) {
      failed++;
      continue;
    }
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

  return { paths, failed, recusados, semCompressao };
}
