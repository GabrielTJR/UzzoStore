"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { IconClose } from "@/components/icons";
import { FORMATOS_ACEITOS } from "@/lib/compress-image";
import { urlDoCaminho, type ProductPhoto } from "@/lib/home-config";
import { resumoRecusados, uploadPhotos } from "@/lib/upload-photos";
import { useModal } from "@/lib/use-modal";

/**
 * Escolher foto: o acervo de fotos já cadastradas dos produtos (com busca por
 * nome da peça) e, quando `permiteEnviar`, o envio de uma foto nova de
 * campanha.
 *
 * O envio passa pelo MESMO caminho de todo upload do painel (`uploadPhotos`:
 * compressão no navegador, URL assinada, pasta `home`) — não existe um
 * terceiro caminho de upload. A foto sobe ao escolher o arquivo, mas só entra
 * na loja quando o dono publica; o servidor remonta a URL a partir do caminho.
 *
 * Custo: as miniaturas passam pelo otimizador numa variante só (128 px,
 * guardada 31 dias) e com `loading="lazy"` — só baixa o que aparece na tela,
 * e só quando um admin abre o seletor.
 */
export function PhotoPicker({
  title,
  photos,
  selected,
  permiteEnviar = false,
  extra,
  onPick,
  onClose,
}: {
  title: string;
  photos: ProductPhoto[];
  selected: string | null;
  permiteEnviar?: boolean;
  /** Ação extra no topo (ex.: "Usar a automática"). */
  extra?: React.ReactNode;
  onPick: (url: string, photo: ProductPhoto | null) => void;
  onClose: () => void;
}) {
  const ref = useModal<HTMLDivElement>(true, onClose);
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Agrupa por peça: "a foto da calça bege" se acha pela peça, não por miniatura solta.
  const grupos = useMemo(() => {
    const termo = busca
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();
    const mapa = new Map<string, { nome: string; ativo: boolean; fotos: ProductPhoto[] }>();
    for (const p of photos) {
      const nome = p.productName
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
      if (termo && !nome.includes(termo)) continue;
      const g = mapa.get(p.productId) ?? { nome: p.productName, ativo: p.active, fotos: [] };
      g.fotos.push(p);
      mapa.set(p.productId, g);
    }
    // Peças à venda primeiro.
    return [...mapa.values()].sort((a, b) => Number(b.ativo) - Number(a.ativo));
  }, [photos, busca]);

  async function enviar(file: File) {
    setErro(null);
    setEnviando(true);
    try {
      const { paths, recusados } = await uploadPhotos([file], "home");
      if (paths.length === 0) {
        setErro(
          recusados.length > 0 ? resumoRecusados(recusados) : "Falha ao enviar a foto.",
        );
        return;
      }
      onPick(urlDoCaminho(paths[0]), null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar a foto.");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  // Portal no <body>: a área de trabalho do painel cria um contexto próprio,
  // e o "fixed" preso nela deixava o fim da tela sem a cortina escura.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-sm bg-background outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 className="font-display text-lg font-bold">{title}</h2>
            <p className="mt-0.5 text-sm text-muted">
              Fotos já cadastradas nas peças da loja.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1.5 hover:bg-surface"
          >
            <IconClose size={20} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pela peça"
            className="h-10 min-w-0 flex-1 rounded-xs border border-border bg-background px-3 text-sm"
          />
          {extra}
          {permiteEnviar && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept={FORMATOS_ACEITOS}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void enviar(f);
                }}
              />
              <button
                type="button"
                disabled={enviando}
                onClick={() => inputRef.current?.click()}
                className="inline-flex h-10 items-center rounded-xs border border-border px-4 text-sm font-medium hover:border-foreground disabled:opacity-50"
              >
                {enviando ? "Enviando…" : "Enviar foto nova"}
              </button>
            </>
          )}
        </div>
        {erro && <p className="px-5 pt-3 text-sm text-red-600">{erro}</p>}

        <div className="overflow-y-auto p-5">
          {grupos.length === 0 && (
            <p className="text-sm text-muted">Nenhuma foto encontrada.</p>
          )}
          <div className="space-y-6">
            {grupos.map((g) => (
              <section key={g.fotos[0].productId}>
                <h3 className="mb-2 text-sm font-semibold">
                  {g.nome}
                  {!g.ativo && (
                    <span className="ml-2 font-normal text-muted">fora da loja</span>
                  )}
                </h3>
                <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                  {g.fotos.map((p) => {
                    const ativo = p.url === selected;
                    return (
                      <li key={p.url}>
                        <button
                          type="button"
                          onClick={() => onPick(p.url, p)}
                          title={p.color ? `${g.nome} — ${p.color}` : g.nome}
                          aria-pressed={ativo}
                          className={`relative block aspect-[2/3] w-full overflow-hidden rounded-xs bg-surface ring-offset-2 ring-offset-background ${
                            ativo ? "ring-2 ring-accent" : "hover:ring-2 hover:ring-foreground/40"
                          }`}
                        >
                          <Image
                            src={p.url}
                            alt={p.color ? `${g.nome}, ${p.color}` : g.nome}
                            fill
                            sizes="128px"
                            className="object-cover"
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
