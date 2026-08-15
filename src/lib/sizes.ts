// Ordenação natural de tamanhos de vestuário (P < M < G < GG ...), com apoio a
// tamanhos numéricos (38 < 40 < 42). Usada na vitrine e no admin para não cair
// no localeCompare puro (que ordena "GG" antes de "M").
const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG", "XGG", "XXG", "EG", "EGG"];

export function compareSizes(a: string | null, b: string | null): number {
  const sa = (a ?? "").trim().toUpperCase();
  const sb = (b ?? "").trim().toUpperCase();

  // Sem tamanho (peça única) vai para o fim.
  if (!sa && !sb) return 0;
  if (!sa) return 1;
  if (!sb) return -1;

  const ia = SIZE_ORDER.indexOf(sa);
  const ib = SIZE_ORDER.indexOf(sb);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1; // tamanhos conhecidos antes dos desconhecidos
  if (ib !== -1) return 1;

  const na = Number(sa);
  const nb = Number(sb);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;

  return sa.localeCompare(sb);
}
