/**
 * Dados de contato da loja — módulo NEUTRO (sem imports de servidor), para
 * cabeçalho, rodapé e páginas usarem o mesmo número e o mesmo endereço.
 *
 * ⚠️ O endereço é o da Rua 3650 (CEP 88330-218), o mesmo que origina o frete.
 * A loja é de esquina e o cartão CNPJ traz a Av. Brasil; misturar os dois
 * quebra a cotação e manda o cliente rodar quarteirão (ver CLAUDE.md).
 */
export const WHATSAPP_NUMBER_DISPLAY = "(47) 99174-4865";
export const WHATSAPP_URL = "https://wa.me/5547991744865";
export const MAPS_URL = "https://maps.app.goo.gl/bUxWeib7bJHjGp3K6";
export const INSTAGRAM_URL = "https://www.instagram.com/uzzostorebc/";
export const INSTAGRAM_HANDLE = "@uzzostorebc";

export const STORE_ADDRESS_LINE = "Rua 3650, nº 3573 — Sala 2";
export const STORE_CITY_LINE = "Balneário Camboriú, SC";

/** Link de WhatsApp com mensagem pronta. */
export function whatsappLink(message: string): string {
  return `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`;
}
