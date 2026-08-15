"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { uploadPhotos, resumoRecusados } from "@/lib/upload-photos";
import { FORMATOS_ACEITOS } from "@/lib/compress-image";

/**
 * Campo de imagem para a decoração: envia o arquivo DIRETO ao Storage (URL
 * assinada) e devolve o CAMINHO ao formulário — o servidor remonta a URL
 * pública (nunca confia em URL vinda do cliente). Mostra a prévia do que já
 * está salvo (URL) ou do que acabou de subir (caminho).
 */
export function ImageField({
  label,
  hint,
  value,
  onChange,
  onBusyChange,
}: {
  label: string;
  hint?: string;
  /** URL pública (já salva) ou caminho do Storage (recém-enviado). */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Avisa o formulário que há upload em andamento (trava o "Salvar"). */
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Guarda o par caminho→blob: a prévia segue o VALOR, não a posição do campo.
  // (Slides/cards são removidos por índice; sem isso, a prévia de um ia parar
  //  no slide vizinho e o admin apagava a imagem errada.)
  const [uploaded, setUploaded] = useState<{
    path: string;
    url: string;
  } | null>(null);

  const shown =
    uploaded && uploaded.path === value
      ? uploaded.url
      : value && value.startsWith("http")
        ? value
        : null;

  function setBusyBoth(v: boolean) {
    setBusy(v);
    onBusyChange?.(v);
  }

  async function handleFile(file: File) {
    setError(null);
    setAviso(null);
    setBusyBoth(true);
    try {
      const { paths, recusados, semCompressao } = await uploadPhotos(
        [file],
        "home",
      );
      if (paths.length === 0) {
        setError(
          recusados.length > 0
            ? resumoRecusados(recusados)
            : "Falha ao enviar a imagem.",
        );
        return;
      }
      onChange(paths[0]);
      setUploaded({ path: paths[0], url: URL.createObjectURL(file) });
      // O banner é a maior imagem do site: se subiu sem comprimir, quem
      // cadastrou precisa saber para trocar o arquivo — senão vira egress todo
      // mês, que é exatamente o que derrubou a loja em agosto.
      if (semCompressao.length > 0)
        setAviso("Enviada sem compressão — troque por um JPG menor se possível.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
      setBusyBoth(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {hint && <p className="text-xs text-muted">{hint}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {shown && (
          <div className="relative h-20 w-32 overflow-hidden rounded-md border border-border">
            <Image
              src={shown}
              alt={label}
              fill
              sizes="128px"
              className="object-cover"
              unoptimized={shown.startsWith("blob:")}
            />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={FORMATOS_ACEITOS}
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
          className="text-sm text-muted file:mr-3 file:rounded-full file:border file:border-border file:bg-transparent file:px-4 file:py-2 file:text-sm file:text-foreground"
        />
        {(shown || value) && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setUploaded(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="text-xs text-red-600 underline-offset-4 hover:underline dark:text-red-400"
          >
            remover
          </button>
        )}
        {busy && <span className="text-xs text-muted">enviando…</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
        {aviso && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            {aviso}
          </span>
        )}
      </div>
    </div>
  );
}
