"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { whatsappLink } from "@/lib/store-info";

const WHATSAPP_URL = whatsappLink("Olá! Vim pelo site da Uzzo Store.");

/** Páginas de vitrine onde o botão aparece. */
const ONDE = new Set([
  "/",
  "/produtos",
  "/masculino",
  "/feminino",
  "/ofertas",
  "/destaques",
]);

/**
 * Já rolou a primeira tela? `useSyncExternalStore` (e não state + effect): é o
 * padrão para estado que vem de fora do React, e o snapshot do servidor (`false`)
 * bate com o valor inicial do cliente — sem divergência de hidratação.
 */
function useRolou(limite: number): boolean {
  return useSyncExternalStore(
    (avisa) => {
      window.addEventListener("scroll", avisa, { passive: true });
      return () => window.removeEventListener("scroll", avisa);
    },
    () => window.scrollY > limite,
    () => false,
  );
}

/**
 * O rodapé está na tela? Lá já existe o WhatsApp (em Contato) — e o botão
 * flutuante cobria os cartões da coluna da direita e o endereço da empresa
 * no celular (o dono mandou as capturas, 07/10/2026). Um observador só, sem
 * ouvir rolagem.
 */
function useRodapeNaTela(): boolean {
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const rodape = document.querySelector("footer");
    if (!rodape) return;
    const obs = new IntersectionObserver(([e]) => setVisivel(e.isIntersecting));
    obs.observe(rodape);
    return () => obs.disconnect();
  }, []);
  return visivel;
}

/**
 * Botão flutuante de WhatsApp — o canal onde a loja de fato fecha venda.
 * Aparece só nas páginas de vitrine: na página do produto o rodapé do celular
 * pertence à barra de compra, e em conta/admin/checkout ele só atrapalha.
 *
 * Só entra DEPOIS da primeira rolagem: parado na primeira tela ele cobria o
 * segundo botão do hero no celular. Quem acabou de chegar ainda não tem
 * dúvida para tirar; quem rolou e não comprou, talvez tenha.
 *
 * Some de novo quando o rodapé aparece (ver `useRodapeNaTela`).
 *
 * `z-30`: abaixo do cabeçalho (z-40), senão ficava por cima do fundo escuro da
 * gaveta do menu.
 */
export function WhatsappFab() {
  const pathname = usePathname();
  const rolou = useRolou(360);
  const rodape = useRodapeNaTela();
  if (!ONDE.has(pathname)) return null;
  const mostra = rolou && !rodape;

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a loja no WhatsApp"
      tabIndex={mostra ? 0 : -1}
      aria-hidden={!mostra}
      className={`fixed bottom-5 right-5 z-30 flex h-13 w-13 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-[opacity,transform] duration-200 ${
        mostra ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <svg
        viewBox="0 0 32 32"
        width="26"
        height="26"
        fill="currentColor"
        aria-hidden
      >
        <path d="M16 3C9.4 3 4 8.3 4 14.9c0 2.6.8 5 2.3 7L4.5 28l6.3-1.7c1.9 1 4 1.6 6.2 1.6 6.6 0 12-5.3 12-11.9S22.6 3 16 3zm0 21.8c-2 0-3.9-.6-5.6-1.6l-.4-.2-3.7 1 1-3.6-.3-.4a9.7 9.7 0 0 1-1.6-5.1c0-5.4 4.4-9.8 9.9-9.8s9.9 4.4 9.9 9.8-4.4 9.9-9.9 9.9h.7zm5.4-7.3c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6.1a8 8 0 0 1-2.4-1.5 8.8 8.8 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-1-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4l-.7-.3z" />
      </svg>
    </a>
  );
}
