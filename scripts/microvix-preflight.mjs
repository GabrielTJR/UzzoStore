#!/usr/bin/env node
/**
 * PRÉ-VOO DO WEBSERVICE B2C DO LINX MICROVIX — fase 0 da integração.
 *
 * Roda na máquina do dono, contra a base do ERP, e NÃO toca no site: nenhuma
 * escrita, nenhum deploy, nenhuma invocação na Vercel. O objetivo é descobrir o
 * que a chave da loja realmente enxerga ANTES de dimensionar qualquer coisa.
 *
 * Por que existe, em vez de "só ir codando":
 *
 *   1. O rótulo dos eixos da grade é CONFIGURÁVEL por loja. A especificação diz
 *      que grade1 é tamanho e grade2 é cor, mas quem manda é o cadastro. Uma
 *      chamada a B2CConsultaLegendasCadastrosAuxiliares evita importar o
 *      catálogo inteiro com cor e tamanho trocados.
 *
 *   2. O método de SALDO é o único que vai rodar de 15 em 15 minutos. Se ele
 *      não aceitar cursor incremental, cada rodada devolve a base inteira — que
 *      é exatamente o "consumo indevido" que, segundo o Checklist de
 *      Contratação da Linx, leva à desativação da chave SEM PRÉVIO AVISO.
 *      O teste `--incremental` responde isso com duas chamadas.
 *
 *   3. A URL muda entre versões da documentação (com e sem "/1.0"). Descobrir
 *      qual responde custa uma requisição; descobrir em produção custa caro.
 *
 * ⚠️ NUNCA transforme este script em laço, cron ou watcher. Ele é de uso
 *    pontual. Cada execução completa faz ~20 requisições.
 *
 * Uso:
 *   node scripts/microvix-preflight.mjs                 # bateria completa
 *   node scripts/microvix-preflight.mjs --metodo B2CConsultaProdutos
 *   node scripts/microvix-preflight.mjs --incremental   # só o teste de cursor
 *   node scripts/microvix-preflight.mjs --aceitacao     # base de homologação
 *   node scripts/microvix-preflight.mjs --timestamp NULL  # se tudo vier vazio
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = join(RAIZ, ".microvix-preflight");

/** Pausa entre requisições. A Linx não publica um limite; ser educado é grátis. */
const PAUSA_MS = 1500;

// ---------------------------------------------------------------------------
// Ambiente
// ---------------------------------------------------------------------------

/** Lê .env.local sem depender de pacote — o script roda fora do Next. */
function lerEnv() {
  const arquivo = join(RAIZ, ".env.local");
  if (!existsSync(arquivo)) return {};
  const env = {};
  for (const linha of readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    // Corta comentário à direita, mas só quando há espaço antes do "#":
    // um valor legítimo pode conter "#".
    let valor = m[2].replace(/\s+#.*$/, "").trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    )
      valor = valor.slice(1, -1);
    env[m[1]] = valor;
  }
  return env;
}

const env = { ...lerEnv(), ...process.env };
const args = process.argv.slice(2);
const temFlag = (f) => args.includes(f);
const valorFlag = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : null;
};

const ACEITACAO = temFlag("--aceitacao") || env.MICROVIX_ACEITACAO === "1";

/**
 * A prosa da especificação diz que a carga inicial usa timestamp 0; o exemplo
 * de envelope da seção 8 usa a string "NULL". Não são a mesma coisa e a doc não
 * diz qual vale. Se as respostas vierem todas vazias, rode com `--timestamp NULL`
 * antes de concluir que a base está vazia.
 */
const TIMESTAMP_INICIAL = valorFlag("--timestamp") ?? "0";

const CHAVE = env.MICROVIX_CHAVE?.trim();
const CNPJ = env.MICROVIX_CNPJ?.replace(/\D/g, "");
const PORTAL = env.MICROVIX_PORTAL?.trim();
const USUARIO = env.MICROVIX_B2C_USER?.trim() || "linx_b2c";
const SENHA = env.MICROVIX_B2C_PASSWORD?.trim() || "linx_b2c";

/**
 * Candidatas de URL. A V64 grafa sem "/1.0"; documentação anterior grafa com.
 * O pré-voo descobre qual responde em vez de escolhermos no escuro.
 */
function urlsCandidatas() {
  const host = ACEITACAO
    ? "https://webapi-aceitacao.microvix.com.br"
    : "https://webapi.microvix.com.br";
  const doEnv = env.MICROVIX_B2C_URL?.trim();
  const padrao = [`${host}/api/integracao`, `${host}/1.0/api/integracao`];
  // A do .env vai primeiro, mas só se combinar com o ambiente escolhido —
  // senão um --aceitacao apontaria para produção sem avisar.
  if (doEnv && doEnv.startsWith(host)) return [doEnv, ...padrao.filter((u) => u !== doEnv)];
  return padrao;
}

// ---------------------------------------------------------------------------
// Protocolo
// ---------------------------------------------------------------------------

const escapar = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Monta o envelope de CONSULTA (métodos de saída). */
function montarConsulta(metodo, parametros) {
  const linhas = Object.entries(parametros)
    .map(([id, v]) => `    <Parameter id="${escapar(id)}">${escapar(v)}</Parameter>`)
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<LinxMicrovix>
  <Authentication user="${escapar(USUARIO)}" password="${escapar(SENHA)}"/>
  <ResponseFormat>xml</ResponseFormat>
  <IdPortal>${escapar(PORTAL)}</IdPortal>
  <Command>
    <Name>${escapar(metodo)}</Name>
    <Parameters>
${linhas}
    </Parameters>
  </Command>
</LinxMicrovix>`;
}

async function consultar(url, metodo, extras = {}) {
  const corpo = montarConsulta(metodo, {
    chave: CHAVE,
    cnpjEmp: CNPJ,
    ...extras,
  });
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
      },
      body: corpo,
    });
    const texto = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      texto,
      bytes: Buffer.byteLength(texto, "utf8"),
      ms: Date.now() - t0,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      texto: "",
      bytes: 0,
      ms: Date.now() - t0,
      erro: err instanceof Error ? err.message : String(err),
    };
  }
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Leitura superficial da resposta
//
// De propósito NÃO existe um parser de verdade aqui. O formato de retorno não
// está documentado — descobri-lo é justamente o produto desta fase. Guardamos o
// XML cru e só medimos o que dá para medir sem assumir esquema.
// ---------------------------------------------------------------------------

function farejar(xml) {
  if (!xml.trim()) return { vazio: true, registros: 0, campos: [] };

  // Erro costuma vir como texto solto ou como <Erro>/<Message>.
  const erro = xml.match(/<(?:Erro|Error|Message|Mensagem)>([^<]{0,200})</i);

  // O nome da tag repetida com mais ocorrências é, quase sempre, o registro.
  const contagem = new Map();
  for (const m of xml.matchAll(/<([A-Za-z_][\w.-]*)[\s>]/g)) {
    const tag = m[1];
    contagem.set(tag, (contagem.get(tag) ?? 0) + 1);
  }
  const ordenadas = [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  const registros = ordenadas.length ? ordenadas[0][1] : 0;

  // Maior timestamp presente: é o cursor da próxima chamada incremental.
  let maiorTimestamp = null;
  for (const m of xml.matchAll(/timestamp["'>\s]*[:=]?\s*["']?(\d{6,})/gi)) {
    const v = BigInt(m[1]);
    if (maiorTimestamp === null || v > maiorTimestamp) maiorTimestamp = v;
  }

  return {
    vazio: false,
    erro: erro?.[1]?.trim() || null,
    registros,
    tagRegistro: ordenadas.length ? ordenadas[0][0] : null,
    campos: ordenadas.slice(0, 24).map(([t, n]) => `${t}×${n}`),
    maiorTimestamp: maiorTimestamp?.toString() ?? null,
  };
}

const kb = (b) => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} kB`);

function salvar(nome, conteudo) {
  mkdirSync(DESTINO, { recursive: true });
  const caminho = join(DESTINO, `${nome}.xml`);
  writeFileSync(caminho, conteudo, "utf8");
  return caminho;
}

// ---------------------------------------------------------------------------
// A bateria
// ---------------------------------------------------------------------------

/**
 * Uma chamada de cada. A ordem importa: os dois primeiros decidem se vale a
 * pena continuar, e o de saldo é o que dimensiona o custo de tudo.
 */
const BATERIA = [
  {
    metodo: "B2CConsultaCNPJsChave",
    porque: "teste de fumaça — confirma que a chave vale e diz que CNPJs ela cobre",
    // Em aceitação a Linx exige esta classificação, senão volta vazio e parece
    // chave inválida quando não é.
    extras: ACEITACAO ? { id_classificacao: "6" } : {},
    semTimestamp: true,
  },
  {
    metodo: "B2CConsultaLegendasCadastrosAuxiliares",
    porque: "DECIDE O MAPEAMENTO: grade1 é tamanho e grade2 é cor NESTA loja?",
  },
  {
    metodo: "B2CConsultaEmpresas",
    porque: "confirma a empresa e se ela envia produtos/estoque ao commerce",
  },
  {
    metodo: "B2CConsultaProdutosDepositos",
    porque: "quais depósitos existem e quais contam como estoque (disponivel='S')",
  },
  {
    metodo: "B2CConsultaProdutosDetalhesDepositos",
    porque: "O SALDO — é o método que rodaria de 15 em 15 min. Medir com carinho",
    critico: true,
  },
  {
    metodo: "B2CConsultaProdutos",
    porque: "o catálogo: quantos SKUs a chave devolve e qual o peso da resposta",
    critico: true,
  },
  { metodo: "B2CConsultaGrade1", porque: "nomes de tamanho" },
  { metodo: "B2CConsultaGrade2", porque: "nomes de cor" },
  { metodo: "B2CConsultaSetores", porque: "vira nossas categorias" },
  { metodo: "B2CConsultaProdutosCustos", porque: "uma das fontes de preço" },
  { metodo: "B2CConsultaProdutosTabelasPrecos", porque: "a outra fonte de preço" },
  { metodo: "B2CConsultaProdutosPromocao", porque: "promoção com data de início/fim" },
  {
    metodo: "B2CConsultaProdutosImagensURL",
    porque: "decide se a fase 4 existe: o ERP tem foto ou não?",
  },
  { metodo: "B2CConsultaProdutosDimensoes", porque: "peso e medidas para o frete" },
  { metodo: "B2CConsultaStatus", porque: "status de pedido cadastrados (fase 5)" },
  { metodo: "B2CConsultaTipoEncomenda", porque: "o 'tipo_frete' do pedido (fase 5)" },
  { metodo: "B2CConsultaPlanos", porque: "planos de pagamento a espelhar (fase 5)" },
  { metodo: "B2CConsultaTransportadores", porque: "transportadoras cadastradas (fase 5)" },
];

function faltando() {
  const faltas = [];
  if (!CHAVE) faltas.push("MICROVIX_CHAVE");
  if (!CNPJ) faltas.push("MICROVIX_CNPJ");
  if (!PORTAL) faltas.push("MICROVIX_PORTAL");
  return faltas;
}

async function descobrirUrl() {
  const candidatas = urlsCandidatas();
  for (const url of candidatas) {
    process.stdout.write(`  testando ${url} … `);
    const r = await consultar(url, "B2CConsultaCNPJsChave", {
      timestamp: TIMESTAMP_INICIAL,
      ...(ACEITACAO ? { id_classificacao: "6" } : {}),
    });
    if (r.erro) {
      console.log(`falhou (${r.erro})`);
    } else if (r.status === 404) {
      console.log("404 — endpoint não existe aqui");
    } else if (!r.ok) {
      console.log(`HTTP ${r.status}`);
    } else {
      console.log(`HTTP 200, ${kb(r.bytes)} ✓`);
      return { url, primeira: r };
    }
    await dormir(PAUSA_MS);
  }
  return { url: null };
}

/**
 * Duas chamadas: a base inteira, depois a mesma consulta usando o maior
 * timestamp devolvido. Se a segunda vier bem menor (idealmente vazia), o método
 * aceita cursor e a sincronização de 15 min é segura. Se vier do mesmo tamanho,
 * NÃO é incremental — e aí a frequência precisa cair drasticamente.
 */
async function testeIncremental(url, metodo) {
  console.log(`\n── Teste de cursor incremental: ${metodo}`);
  const cheia = await consultar(url, metodo, { timestamp: TIMESTAMP_INICIAL });
  const f1 = farejar(cheia.texto);
  console.log(`   carga cheia (timestamp=0): HTTP ${cheia.status}, ${kb(cheia.bytes)}, ~${f1.registros} registros, ${cheia.ms} ms`);
  salvar(`${metodo}.cheia`, cheia.texto);

  if (!f1.maiorTimestamp) {
    console.log("   ⚠ nenhum timestamp encontrado na resposta — não dá para testar o cursor.");
    console.log("     Olhe o XML salvo e ajuste o farejador, ou pergunte à Linx na homologação.");
    return;
  }

  await dormir(PAUSA_MS);
  const incr = await consultar(url, metodo, { timestamp: f1.maiorTimestamp });
  const f2 = farejar(incr.texto);
  salvar(`${metodo}.incremental`, incr.texto);
  console.log(`   incremental (timestamp=${f1.maiorTimestamp}): HTTP ${incr.status}, ${kb(incr.bytes)}, ~${f2.registros} registros`);

  const razao = cheia.bytes > 0 ? incr.bytes / cheia.bytes : 1;
  if (razao < 0.1) {
    console.log(`   ✅ INCREMENTAL FUNCIONA (${(razao * 100).toFixed(1)}% do tamanho). Sincronizar de 15 em 15 min é seguro.`);
  } else if (razao < 0.9) {
    console.log(`   ⚠ parcialmente incremental (${(razao * 100).toFixed(0)}%). Investigar antes de definir a frequência.`);
  } else {
    console.log(`   ❌ NÃO É INCREMENTAL (${(razao * 100).toFixed(0)}% do tamanho).`);
    console.log("      Sincronizar de 15 em 15 min devolveria a base inteira 96×/dia — que é");
    console.log("      o consumo que a Linx diz desativar a chave sem aviso. NÃO faça isso:");
    console.log("      baixe a frequência e pergunte à Linx qual é o limite aceito.");
  }
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  PRÉ-VOO — WebService B2C Linx Microvix                       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`Ambiente : ${ACEITACAO ? "ACEITAÇÃO (homologação)" : "PRODUÇÃO"}`);
  console.log(`Portal   : ${PORTAL || "(não configurado)"}`);
  console.log(`CNPJ     : ${CNPJ || "(não configurado)"}`);
  // Só o comprimento: a chave vale como senha de banco, e saída de terminal
  // acaba colada em conversa, chamado e print.
  console.log(`Chave    : ${CHAVE ? `configurada (${CHAVE.length} caracteres)` : "(não configurada)"}`);
  console.log(`Timestamp: ${TIMESTAMP_INICIAL}`);

  const faltas = faltando();
  if (faltas.length) {
    console.log(`\n❌ Falta preencher no .env.local: ${faltas.join(", ")}`);
    console.log("\n   Esses três valores vêm da Linx no e-mail/chamado de ativação:");
    console.log("     MICROVIX_CHAVE   — o identificador longo, formato 243BEEAC-F846-4709-8505-51448251F64F");
    console.log("     MICROVIX_CNPJ    — CNPJ da empresa, só números (a Uzzo: 67134725000143)");
    console.log("     MICROVIX_PORTAL  — o número do portal da loja, ex.: 18948");
    console.log("\n   Usuário e senha já estão preenchidos e são públicos (linx_b2c/linx_b2c).");
    process.exitCode = 1;
    return;
  }

  console.log("\n── Descobrindo qual URL responde");
  const { url } = await descobrirUrl();
  if (!url) {
    console.log("\n❌ Nenhuma URL respondeu. Confira a chave e se o módulo B2C está ativo no portal.");
    process.exitCode = 1;
    return;
  }
  console.log(`\n✅ Use esta no .env.local:  MICROVIX_B2C_URL=${url}`);

  if (temFlag("--incremental")) {
    await dormir(PAUSA_MS);
    await testeIncremental(url, "B2CConsultaProdutosDetalhesDepositos");
    await dormir(PAUSA_MS);
    await testeIncremental(url, "B2CConsultaProdutos");
    console.log(`\nRespostas cruas em ${DESTINO}\n`);
    return;
  }

  const so = valorFlag("--metodo");
  const lista = so ? BATERIA.filter((b) => b.metodo === so) : BATERIA;
  if (so && lista.length === 0) {
    // Método fora da bateria ainda pode ser consultado — a lista é uma
    // curadoria, não um catálogo fechado.
    lista.push({ metodo: so, porque: "avulso" });
  }

  console.log(`\n── Bateria: ${lista.length} método(s), uma chamada cada, ${PAUSA_MS} ms entre elas\n`);

  const resumo = [];
  for (const item of lista) {
    const extras = { ...(item.extras ?? {}) };
    if (!item.semTimestamp) extras.timestamp = TIMESTAMP_INICIAL;
    const r = await consultar(url, item.metodo, extras);
    const f = farejar(r.texto);
    if (r.texto) salvar(item.metodo, r.texto);

    const marca = item.critico ? "★" : " ";
    let situacao;
    if (r.erro) situacao = `erro de rede: ${r.erro}`;
    else if (!r.ok) situacao = `HTTP ${r.status}`;
    else if (f.erro) situacao = `recusado: ${f.erro}`;
    else if (f.vazio) situacao = "resposta VAZIA";
    else situacao = `${kb(r.bytes)}, ~${f.registros} reg.`;

    console.log(`${marca} ${item.metodo.padEnd(38)} ${situacao}`);
    console.log(`   ↳ ${item.porque}`);
    if (f.campos?.length && !f.vazio && !f.erro)
      console.log(`   ↳ tags: ${f.campos.slice(0, 12).join(" ")}`);
    console.log("");

    resumo.push({ metodo: item.metodo, status: r.status, bytes: r.bytes, registros: f.registros });
    await dormir(PAUSA_MS);
  }

  const total = resumo.reduce((s, r) => s + r.bytes, 0);
  console.log("──────────────────────────────────────────────────────────────");
  console.log(`Total trafegado nesta execução: ${kb(total)}`);
  console.log(`Respostas cruas salvas em: ${DESTINO}`);
  if (resumo.every((r) => r.registros === 0) && TIMESTAMP_INICIAL === "0") {
    console.log("\n⚠ TODAS as respostas vieram vazias. Antes de concluir que a base");
    console.log("  está vazia, tente o outro valor de carga inicial:");
    console.log("     node scripts/microvix-preflight.mjs --timestamp NULL");
    console.log("  (a prosa da spec diz 0; o exemplo de envelope dela usa \"NULL\").");
  }
  console.log("\nPróximo passo: rodar com --incremental para descobrir se o método");
  console.log("de saldo aceita cursor. É o que decide a frequência da sincronização.\n");
}

main().catch((err) => {
  console.error("\n❌ Falhou:", err);
  process.exitCode = 1;
});
