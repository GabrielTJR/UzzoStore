/**
 * Conteúdo do hero da home ("Etiqueta"): uma foto de corpo inteiro e as
 * etiquetas que apontam o que o tecido faz.
 *
 * Fica em código enquanto a decoração da home está desligada (ver
 * `HOME_DECORATIONS_ENABLED`). Trocar a campanha = trocar este arquivo.
 *
 * COMO POSICIONAR UMA ETIQUETA — tudo é porcentagem da moldura da foto (que é
 * sempre 4:5, no celular e no desktop, justamente para os pontos não saírem do
 * lugar quando a tela muda):
 *   - `x`/`y`: onde fica o ponto, sobre a roupa;
 *   - `tx`/`ty`: onde a linha termina (encostando no rótulo);
 *   - `rotulo`: canto do rótulo — use `left` OU `right`, mais `top`.
 *
 * A foto precisa ter fundo limpo ao redor do modelo: os rótulos ficam sobre o
 * fundo, não sobre a roupa. Os textos vêm das campanhas da própria loja
 * ("Tecnologia que veste bem"; respirável, não amassa, flexibilidade).
 */
export type HeroTag = {
  label: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  rotulo: { left?: string; right?: string; top: string };
};

export const HOME_HERO = {
  image:
    "https://anlbavcstwffnpisacax.supabase.co/storage/v1/object/public/product-images/11c5e91d-ebcc-4a2b-bfad-efe28444228e/9d837c36-b762-4062-b407-4cb7c382a9de.png",
  alt: "Modelo de corpo inteiro vestindo polo azul-marinho e calça de alfaiataria bege",
  /** Enquadramento da foto dentro da moldura 4:5. */
  objectPosition: "50% 12%",
  title: "Tecnologia que veste bem.",
  text: "Peças com tecidos tecnológicos que acompanham você em todos os momentos.",
  /** Peça da foto, para quem quer exatamente o que viu. */
  look: { name: "Calça Zara Alfaiataria", slug: "calca-zara-alfaiataria" },
  tags: [
    {
      label: "Não amassa",
      x: 56,
      y: 33,
      tx: 72,
      ty: 20,
      rotulo: { left: "66%", top: "14%" },
    },
    {
      label: "Respirável",
      x: 36,
      y: 31,
      tx: 22,
      ty: 44,
      rotulo: { left: "4%", top: "43%" },
    },
    {
      label: "Flexibilidade inteligente",
      x: 55,
      y: 74,
      tx: 72,
      ty: 83,
      rotulo: { right: "4%", top: "82%" },
    },
  ] satisfies HeroTag[],
};

/**
 * O que o tecido faz — a faixa preta da home. Texto das campanhas da loja.
 */
export const FABRIC_CLAIMS = [
  { title: "Respirável", text: "Mais frescor no seu dia." },
  { title: "Leve", text: "Sensação de liberdade do começo ao fim do dia." },
  { title: "Não amassa", text: "Sai da mala pronta para usar." },
  { title: "Secagem rápida", text: "Mais tempo seco, mais tempo livre." },
];
