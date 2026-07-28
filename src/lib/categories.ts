/**
 * Categorias agora são dirigidas pelo banco (tabela `categories`, kind `setor`),
 * geridas em /admin/categorias. Este módulo guarda só o helper de slug — puro,
 * seguro para client e server — usado nas URLs de filtro da vitrine.
 * Os dados vêm de `getCategories()` (vitrine) e `getAdminCategories()` (admin).
 */
export type StoreCategory = { id: string; name: string };

/** Slug amigável e estável a partir do nome da categoria (ex.: "Calças" -> "calcas"). */
export function categorySlug(name: string): string {
  const diacritics = new RegExp("[\\u0300-\\u036f]", "g");
  return name
    .normalize("NFD")
    .replace(diacritics, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
