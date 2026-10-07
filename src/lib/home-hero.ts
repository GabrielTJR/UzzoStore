/**
 * Conteúdo do hero da home ("Etiqueta", versão de tela inteira — out/2026):
 * uma foto que cobre a tela e etiquetas que apontam o que o tecido faz.
 *
 * Desde a migração 0023 a campanha é trocada pelo PAINEL (Vitrine → Página
 * inicial, `lib/home-config.ts`). Este arquivo é o VALOR DE FÁBRICA: o que a
 * loja mostra sem a migração, sem nada publicado ou se a leitura falhar — e é
 * por onde o editor começa na primeira vez.
 *
 * COMO AS ETIQUETAS SE POSICIONAM — tudo é porcentagem DA FOTO (0–100 na
 * largura e na altura da imagem), não da tela. A foto cobre a tela como um
 * `object-cover`, mas desenhada como uma caixa com a proporção dela
 * (`.hero-caixa` em globals.css); as etiquetas vivem dentro dessa caixa e
 * andam junto com a foto. Por isso o ponto fica sobre a roupa em qualquer
 * celular — o que muda de um aparelho para outro é só QUANTO da borda da foto
 * aparece.
 *
 * Cada etiqueta tem uma posição para o CELULAR e outra para o COMPUTADOR (ou
 * `null` = não aparece naquele formato): no celular a foto é a tela inteira e
 * o título cobre a parte de baixo; no computador a foto ocupa a metade direita
 * e aparece quase inteira. Os campos:
 *   - `x`/`y`: o ponto, sobre a roupa;
 *   - `lx`/`ly`: onde a linha termina e o rótulo encosta;
 *   - `lado`: "d" = o rótulo cresce para a direita a partir de `lx`; "e" = para
 *     a esquerda (a borda direita dele fica em `lx`).
 *
 * A foto precisa ter fundo limpo ao redor do modelo: os rótulos ficam sobre o
 * fundo, não sobre a roupa.
 */
export type PosEtiqueta = {
  x: number;
  y: number;
  lx: number;
  ly: number;
  lado: "e" | "d";
};

export type HeroTag = {
  label: string;
  cel: PosEtiqueta | null;
  pc: PosEtiqueta | null;
};

export const HOME_HERO = {
  image:
    "https://anlbavcstwffnpisacax.supabase.co/storage/v1/object/public/product-images/11c5e91d-ebcc-4a2b-bfad-efe28444228e/9d837c36-b762-4062-b407-4cb7c382a9de.png",
  alt: "Modelo de corpo inteiro vestindo polo azul-marinho e calça de alfaiataria bege",
  /** Largura ÷ altura da foto (1086 × 1448). */
  ratio: 0.75,
  title: "Tecnologia que veste bem.",
  text: "Peças com tecidos tecnológicos que acompanham você em todos os momentos.",
  /** Peça da foto, para quem quer exatamente o que viu. */
  look: { name: "Calça Zara Alfaiataria", slug: "calca-zara-alfaiataria" },
  tags: [
    {
      label: "Não amassa",
      cel: { x: 57.4, y: 25, lx: 66, ly: 16, lado: "d" },
      pc: { x: 57.4, y: 25, lx: 82, ly: 15, lado: "d" },
    },
    {
      label: "Respirável",
      cel: { x: 43.8, y: 35.3, lx: 33, ly: 29, lado: "e" },
      pc: { x: 43.8, y: 35.3, lx: 16, ly: 27, lado: "e" },
    },
    {
      label: "Flexibilidade inteligente",
      // No celular cairia embaixo do título.
      cel: null,
      pc: { x: 55, y: 70, lx: 66, ly: 76, lado: "d" },
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
