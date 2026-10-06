"use client";

import Link from "next/link";
import { WHATSAPP_URL } from "@/lib/store-info";

/**
 * Falha ao montar uma página da vitrine (o banco não respondeu, por exemplo).
 *
 * As leituras do catálogo LANÇAM quando o banco falha, de propósito: devolver
 * vazio gravaria "0 peças" ou "produto não existe" no cache. Na maior parte das
 * vezes a página anterior, já guardada pronta, continua no ar e esta tela nem
 * aparece; ela só vale para a página que ainda não tinha versão guardada.
 * Cabeçalho e rodapé seguem em volta (o layout da loja não é refeito).
 */
export default function ErroDaLoja({ reset }: { reset: () => void }) {
  return (
    <section className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-bold">
        Não conseguimos carregar esta página
      </h1>
      <p className="mt-3 text-muted">
        Foi uma falha momentânea do nosso lado. Tente de novo em instantes.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="h-12 rounded-xs bg-foreground px-6 font-semibold text-background hover:opacity-90"
        >
          Tentar de novo
        </button>
        <Link
          href={WHATSAPP_URL}
          className="inline-flex h-12 items-center rounded-xs border border-foreground px-6 font-semibold"
        >
          Falar no WhatsApp
        </Link>
      </div>
    </section>
  );
}
