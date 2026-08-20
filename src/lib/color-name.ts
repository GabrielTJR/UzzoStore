/**
 * Exibição do nome da cor — módulo NEUTRO (sem import de servidor), porque
 * quem mais precisa dele é client component.
 *
 * O cadastro nasceu com caixa inconsistente ("BEGE" ao lado de "Cinza"): o
 * nome vem digitado à mão em /admin/cores e, em tela, caixa alta parece grito.
 * Normalizar na exibição garante que um cadastro novo desalinhado não estrague
 * a vitrine antes de alguém perceber.
 */
export function displayColor(name: string): string {
  return name
    .toLocaleLowerCase("pt-BR")
    .replace(
      /(^|\s|-)([\p{L}])/gu,
      (_, sep, ch) => sep + ch.toLocaleUpperCase("pt-BR"),
    );
}
