"use client";

import { useRef, useState } from "react";
import { commitPhotosAction } from "./actions";
import { uploadPhotos, resumoRecusados } from "@/lib/upload-photos";
import { FORMATOS_ACEITOS } from "@/lib/compress-image";
import { useToast } from "@/components/toast";

export function AddPhotosForm({ productColorId }: { productColorId: string }) {
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState(0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const files = Array.from(inputRef.current?.files ?? []);
    if (files.length === 0) {
      setError("Selecione ao menos uma imagem.");
      return;
    }

    setBusy(true);
    try {
      const { paths, failed, recusados, semCompressao } = await uploadPhotos(
        files,
        productColorId,
      );
      if (paths.length === 0) {
        // Sem o motivo, quem cadastrou não tem como saber que o problema era o
        // formato (HEIC do iPhone é o caso comum) e fica tentando de novo.
        setError(
          recusados.length > 0
            ? `Nenhuma foto enviada — ${resumoRecusados(recusados)}.`
            : "Falha ao enviar as imagens.",
        );
        return;
      }
      const res = await commitPhotosAction(productColorId, paths);
      if (!res.ok) {
        setError(res.error ?? "Erro ao salvar as fotos.");
        return;
      }

      const avisos: string[] = [];
      if (failed > 0) avisos.push(`${failed} falhou(aram) no envio`);
      if (recusados.length > 0)
        avisos.push(`recusada(s): ${resumoRecusados(recusados)}`);
      if (semCompressao.length > 0)
        avisos.push(
          `${semCompressao.length} subiu(ram) sem compressão (arquivo pesado)`,
        );

      showToast(
        avisos.length > 0
          ? `${paths.length} foto(s) enviada(s) — ${avisos.join("; ")}`
          : "Fotos enviadas",
        avisos.length > 0 ? "error" : "success",
      );
      formRef.current?.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar as fotos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onReset={() => setChosen(0)}
      className="flex flex-wrap items-center gap-x-3 gap-y-2"
    >
      {/* O input de arquivo nativo ("Escolher arquivos / Nenhum arquivo")
          não aceita estilo; ele fica escondido dentro do rótulo, que vira o
          botão. Continua focável e operável por teclado. */}
      <label className="relative inline-flex h-9 cursor-pointer items-center rounded-xs border border-dashed border-foreground/40 px-4 text-sm font-medium hover:border-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
        {chosen > 0
          ? `${chosen} ${chosen === 1 ? "foto escolhida" : "fotos escolhidas"}`
          : "Escolher fotos"}
        <input
          ref={inputRef}
          type="file"
          name="images"
          accept={FORMATOS_ACEITOS}
          multiple
          disabled={busy}
          onChange={(e) => {
            setError(null);
            setChosen(e.currentTarget.files?.length ?? 0);
          }}
          className="sr-only"
        />
      </label>
      <button
        type="submit"
        disabled={busy || chosen === 0}
        className="h-9 rounded-xs bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Enviando…" : "Enviar"}
      </button>
      {error ? (
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      ) : (
        <span className="text-xs text-muted">
          JPG, PNG ou WebP. Comprimidas antes de subir.
        </span>
      )}
    </form>
  );
}
