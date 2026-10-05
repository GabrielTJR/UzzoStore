import "server-only";
import { categorySlug } from "@/lib/categories";
import { getHomeEditorState, getProductPhotos } from "@/lib/home-config-server";
import {
  getCategoryCovers,
  hasDepartmentProducts,
  type CategoryCover,
} from "@/lib/products";
import { shippingConfigured } from "@/lib/shipping";
import { WHATSAPP_URL } from "@/lib/store-info";
import type { HomeEditorProps } from "./home-editor";

/** Menu da prévia: mesma regra do layout da loja (ordem alfabética). */
function paraMenu(covers: CategoryCover[]) {
  return covers
    .map((c) => ({ name: c.name, slug: categorySlug(c.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/**
 * Tudo que o editor precisa, lido de uma vez. Separado da página para a
 * autorização (`requireAdmin`) ficar visível no topo dela.
 *
 * Custo: só roda quando um admin abre a tela. As capas e o "tem feminino?"
 * saem do mesmo cache da loja; o rascunho e o acervo de fotos são lidos na
 * hora (dado de painel não entra no cache público).
 */
export async function loadHomeEditor(): Promise<HomeEditorProps> {
  const [estado, photos, covers, temFeminino] = await Promise.all([
    getHomeEditorState(),
    getProductPhotos(),
    getCategoryCovers(),
    hasDepartmentProducts("feminino"),
  ]);
  return {
    status: estado.status,
    inicial: estado.rascunho,
    publicado: estado.publicado,
    photos,
    covers,
    freteAtivo: shippingConfigured(),
    temFeminino,
    menu: {
      masculino: paraMenu(covers.masculino),
      feminino: paraMenu(covers.feminino),
    },
    whatsappUrl: WHATSAPP_URL,
  };
}
