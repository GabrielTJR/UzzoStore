/**
 * Marca que o cliente está FILTRANDO o catálogo (filtro, chip, ordenação,
 * página). Com a marca, os cards e o título não refazem a entrada em cascata
 * (globals.css, `[data-filtrando]`): ela é para quem CHEGA na página —
 * refeita a cada toque num filtro, os cards novos nasciam transparentes e a
 * grade piscava (o dono viu, 14/10/2026).
 *
 * A marca NÃO sai por tempo: tirar o `animation: none` faz o navegador
 * reiniciar a animação de quem já está na tela, e os cards piscavam de novo
 * segundos depois. Ela sai quando o cliente deixa o catálogo (`soltaFiltrando`
 * na desmontagem da barra) — a não ser que a saída seja o próprio filtro
 * (de /masculino para /produtos?…, que remonta a barra): por isso o tempo
 * desde o último toque.
 */
let ultimoToque = 0;

export function marcaFiltrando() {
  ultimoToque = Date.now();
  document.documentElement.dataset.filtrando = "1";
}

export function soltaFiltrando() {
  if (Date.now() - ultimoToque < 3000) return;
  delete document.documentElement.dataset.filtrando;
}
