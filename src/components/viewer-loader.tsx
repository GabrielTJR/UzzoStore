"use client";

import { useEffect } from "react";
import { viewerAction } from "@/app/(loja)/viewer-actions";
import { temCookieDeSessao, useViewer } from "@/lib/viewer";

/**
 * Preenche o `useViewer` uma vez por carregamento de página (o layout da loja
 * não remonta nas navegações internas). Sem cookie de sessão resolve na hora,
 * sem chamada nenhuma. Falha da chamada vale como anônimo: o pior caso é o
 * ícone mostrar "Entrar" para quem está logado, e o servidor continua sendo
 * quem decide em cada ação.
 */
export function ViewerLoader() {
  const setViewer = useViewer((s) => s.setViewer);
  useEffect(() => {
    if (!temCookieDeSessao()) {
      setViewer({
        logged: false,
        admin: false,
        destaque: false,
        favorites: [],
      });
      return;
    }
    let vivo = true;
    viewerAction()
      .then((v) => vivo && setViewer(v))
      .catch(
        () =>
          vivo &&
          setViewer({
            logged: false,
            admin: false,
            destaque: false,
            favorites: [],
          }),
      );
    return () => {
      vivo = false;
    };
  }, [setViewer]);
  return null;
}
