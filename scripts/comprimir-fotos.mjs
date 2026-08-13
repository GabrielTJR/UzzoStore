/**
 * Recomprime as fotos JÁ ENVIADAS no bucket `product-images`.
 *
 * Por que: as fotos foram salvas como saíram do celular (média de 1,7 MB, até
 * 5,5 MB) e com `cache-control` de 1 hora. Cada variante gerada pelo otimizador
 * de imagem baixa o ORIGINAL do Supabase — foi assim que o egress do plano free
 * passou de 5 GB. Aqui reduzimos para 1600 px / JPEG 82 (~200 KB) e gravamos
 * `cache-control` de 1 ano.
 *
 * A URL de cada foto NÃO muda (mesmo caminho, upsert), então nada no banco
 * precisa ser atualizado.
 *
 * Custo: baixar os originais uma vez (~225 MB de egress). Vale rodar AGORA, no
 * ciclo que já estourou, e não no ciclo novo.
 *
 * Uso (PowerShell, na raiz do projeto):
 *   $env:SUPABASE_SERVICE_ROLE_KEY="<a service role key do projeto>"
 *   node scripts/comprimir-fotos.mjs            # simula, não grava
 *   node scripts/comprimir-fotos.mjs --aplicar  # grava
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { readFileSync } from "node:fs";

const BUCKET = "product-images";
const MAX_LADO = 1600;
const QUALIDADE = 82;
const MINIMO_BYTES = 300 * 1024; // abaixo disso não compensa
const aplicar = process.argv.includes("--aplicar");

// Lê .env.local sem depender de pacote extra.
function env(nome) {
  if (process.env[nome]) return process.env[nome];
  try {
    const txt = readFileSync(".env.local", "utf8");
    const m = txt.match(new RegExp(`^${nome}=(.*)$`, "m"));
    return m?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

const url = env("NEXT_PUBLIC_SUPABASE_URL");
const key = env("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) {
  console.error(
    "Faltou NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.\n" +
      'Defina antes: $env:SUPABASE_SERVICE_ROLE_KEY="..."',
  );
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

/** Percorre o bucket inteiro (raiz + subpastas). */
async function listar(prefixo = "") {
  const saida = [];
  let de = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefixo, { limit: 100, offset: de });
    if (error) throw error;
    if (!data?.length) break;
    for (const item of data) {
      const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
      // Pasta: o Storage devolve `id: null`.
      if (item.id === null) saida.push(...(await listar(caminho)));
      else saida.push({ caminho, tamanho: item.metadata?.size ?? 0 });
    }
    if (data.length < 100) break;
    de += data.length;
  }
  return saida;
}

const fotos = await listar();
const alvo = fotos.filter((f) => f.tamanho >= MINIMO_BYTES);
const totalAntes = fotos.reduce((s, f) => s + f.tamanho, 0);
console.log(
  `${fotos.length} arquivos, ${(totalAntes / 1048576).toFixed(1)} MB. ` +
    `${alvo.length} acima de ${MINIMO_BYTES / 1024} KB.` +
    (aplicar ? "" : "  [simulação — use --aplicar para gravar]"),
);

let depois = 0;
let falhas = 0;
for (const [i, foto] of alvo.entries()) {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(foto.caminho);
    if (error) throw error;

    const entrada = Buffer.from(await data.arrayBuffer());
    const saida = await sharp(entrada)
      .rotate() // respeita o EXIF antes de descartá-lo
      .resize({
        width: MAX_LADO,
        height: MAX_LADO,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: QUALIDADE, mozjpeg: true })
      .toBuffer();

    if (saida.length >= entrada.length) {
      depois += entrada.length;
      console.log(`  = ${foto.caminho} (já estava bom)`);
      continue;
    }

    if (aplicar) {
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(foto.caminho, saida, {
          contentType: "image/jpeg",
          cacheControl: "31536000",
          upsert: true,
        });
      if (upErr) throw upErr;
    }
    depois += saida.length;
    console.log(
      `  ${i + 1}/${alvo.length} ${foto.caminho}: ` +
        `${Math.round(entrada.length / 1024)} KB → ${Math.round(saida.length / 1024)} KB`,
    );
  } catch (e) {
    falhas++;
    depois += foto.tamanho;
    console.error(`  ! ${foto.caminho}: ${e.message ?? e}`);
  }
}

const antes = alvo.reduce((s, f) => s + f.tamanho, 0);
console.log(
  `\n${(antes / 1048576).toFixed(1)} MB → ${(depois / 1048576).toFixed(1)} MB` +
    (falhas ? `  (${falhas} falha(s))` : "") +
    (aplicar ? "" : "  [nada foi gravado]"),
);
