import { create } from "zustand";

/**
 * Quem está olhando a loja: logado? admin? quais favoritos? — guardado NO
 * NAVEGADOR, não lido pelo servidor a cada página.
 *
 * Por quê: ler a sessão (cookie) no servidor tornava TODA página da vitrine
 * dinâmica — home, catálogo e produto eram montados de novo a cada visita em
 * gru1, a região mais cara da Vercel, mesmo com os dados em cache. Com o
 * "quem é" vindo daqui, as páginas viram estáticas (guardadas prontas e
 * derrubadas pelas mesmas etiquetas de cache das mutações), iguais para todo
 * mundo, e só os detalhes por pessoa (ícone da conta, coração, atalhos de
 * admin) se acertam depois de carregar.
 *
 * Quem preenche é o `ViewerLoader` (uma chamada por carregamento de página,
 * e SÓ quando há cookie de sessão — visitante anônimo não chama nada).
 *
 * É só apresentação. Quem decide é o servidor: favoritar, a estrela de
 * destaque e o painel conferem a sessão de novo nas próprias actions.
 */
export type ViewerState = {
  /** Já se sabe quem é (anônimo resolve na hora; logado, após a chamada). */
  ready: boolean;
  logged: boolean;
  admin: boolean;
  /** Pode ligar/desligar destaque da home (Dono e Administrador; Vendedor não). */
  destaque: boolean;
  favorites: string[];
  setViewer: (v: {
    logged: boolean;
    admin: boolean;
    destaque: boolean;
    favorites: string[];
  }) => void;
  setFavorite: (productId: string, on: boolean) => void;
};

export const useViewer = create<ViewerState>()((set) => ({
  ready: false,
  logged: false,
  admin: false,
  destaque: false,
  favorites: [],
  setViewer: (v) => set({ ...v, ready: true }),
  setFavorite: (productId, on) =>
    set((s) => ({
      favorites: on
        ? s.favorites.includes(productId)
          ? s.favorites
          : [...s.favorites, productId]
        : s.favorites.filter((id) => id !== productId),
    })),
}));

/**
 * Há cookie de sessão do Supabase? Os cookies do `@supabase/ssr` não são
 * httpOnly (o client do navegador precisa lê-los), e o nome segue
 * `sb-<ref>-auth-token`, às vezes fatiado em `.0`, `.1`… Sem ele, ninguém
 * está logado e não há por que perguntar ao servidor.
 */
export function temCookieDeSessao(): boolean {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(document.cookie);
}
