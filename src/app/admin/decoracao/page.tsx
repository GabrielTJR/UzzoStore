import type { Metadata } from "next";
import { requireArea } from "@/lib/admin";
import { HomeEditor } from "./home-editor";
import { loadHomeEditor } from "./load-editor";

export const metadata: Metadata = { title: "Página inicial" };

/**
 * Página inicial — o editor do hero, da faixa de avisos e dos atalhos de
 * categoria (out/2026). Substituiu a lista de blocos (`home_sections`), que
 * continua guardada em /admin/decoracao/blocos, sem link no menu.
 */
export default async function PaginaInicialPage() {
  await requireArea("pagina-inicial");
  const props = await loadHomeEditor();
  return <HomeEditor {...props} />;
}
