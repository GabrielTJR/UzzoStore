/**
 * Campos do cliente (CPF, telefone, CEP, nome, e-mail) — módulo NEUTRO, sem
 * imports: o checkout mascara no navegador e as server actions validam no
 * servidor com as MESMAS funções. Validar só de um lado é como dado errado
 * entra (o cliente desliga o JS) ou como um dado certo é recusado (o servidor
 * exige um formato que a tela não produziu).
 *
 * As validações olham os DÍGITOS, não o formato: CPF e telefone gravados antes
 * da máscara existir ("12345678909", "47991744865") continuam valendo.
 */

export function onlyDigits(v: unknown): string {
  return typeof v === "string" ? v.replace(/\D/g, "") : "";
}

/** Texto livre de formulário: sem caracteres de controle, espaços colapsados,
 * aparado e com tamanho máximo. */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** E-mail aparado e em minúsculas; `null` quando não tem cara de e-mail. */
export function normalizeEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const email = v.trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/* ---------- CPF ---------- */

/** Máscara progressiva enquanto se digita: 000.000.000-00. */
export function maskCpf(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/** 11 dígitos, não todos iguais, e os dois dígitos verificadores certos. */
export function isValidCpf(v: string | null | undefined): boolean {
  const d = onlyDigits(v ?? "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (len: number) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(d[i]) * (len + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** CPF válido no formato 000.000.000-00; `null` se inválido. */
export function formatCpf(v: string): string | null {
  return isValidCpf(v) ? maskCpf(v) : null;
}

/* ---------- telefone ---------- */

/** Tira o 55 do país quando o número veio com ele (12 ou 13 dígitos). */
function phoneDigits(v: string): string {
  const d = onlyDigits(v);
  return (d.length === 12 || d.length === 13) && d.startsWith("55")
    ? d.slice(2)
    : d;
}

/** Máscara progressiva: (47) 3333-4444 ou (47) 99999-9999. */
export function maskPhone(v: string): string {
  const d = phoneDigits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = d.length === 11 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** DDD válido (sem zero) + 8 dígitos (fixo) ou 9 começando por 9 (celular). */
export function isValidPhone(v: string | null | undefined): boolean {
  const d = phoneDigits(v ?? "");
  if (!/^[1-9][1-9]/.test(d)) return false;
  if (d.length === 10) return true;
  return d.length === 11 && d[2] === "9";
}

/** Telefone válido no formato com máscara; `null` se inválido. */
export function formatPhone(v: string): string | null {
  return isValidPhone(v) ? maskPhone(v) : null;
}

/* ---------- CEP e endereço ---------- */

export function maskCep(v: string): string {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function isValidCep(v: string | null | undefined): boolean {
  return onlyDigits(v ?? "").length === 8;
}

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE",
  "TO",
] as const;

export function isValidUf(v: string): boolean {
  return (UFS as readonly string[]).includes(v.trim().toUpperCase());
}

/* ---------- nome e perfil ---------- */

/** Nome e sobrenome: 2+ palavras com 2+ letras cada, até 120 caracteres. */
export function isFullName(v: string | null | undefined): boolean {
  const nome = cleanText(v ?? "", 200);
  if (!nome || nome.length > 120) return false;
  const palavras = nome.split(" ").filter((p) => /\p{L}{2,}/u.test(p));
  return palavras.length >= 2;
}

/**
 * A ÚNICA definição de "pode pagar online": nome completo, CPF e telefone
 * válidos. Usada na tela (habilita o botão) e no servidor
 * (`startOnlinePaymentAction`) — se as duas divergissem, o cliente veria o
 * botão liberado e a recusa só depois do clique.
 */
export function perfilCompleto(
  p:
    | { fullName?: string | null; cpf?: string | null; phone?: string | null }
    | null
    | undefined,
): boolean {
  return !!p && isFullName(p.fullName) && isValidCpf(p.cpf) && isValidPhone(p.phone);
}
