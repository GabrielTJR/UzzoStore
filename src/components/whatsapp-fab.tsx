"use client";

import { usePathname } from "next/navigation";

const WHATSAPP_URL =
  "https://wa.me/5547991744865?text=" +
  encodeURIComponent("Olá! Vim pelo site da Uzzo Store.");

/**
 * Botão flutuante de WhatsApp — o canal onde a loja de fato fecha venda.
 * Aparece só na home e na listagem: na página do produto o rodapé do celular
 * pertence à barra fixa de compra, e em conta/admin/checkout ele só atrapalha.
 */
export function WhatsappFab() {
  const pathname = usePathname();
  const show = pathname === "/" || pathname === "/produtos";
  if (!show) return null;

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a loja no WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105"
      style={{ height: 52, width: 52 }}
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
