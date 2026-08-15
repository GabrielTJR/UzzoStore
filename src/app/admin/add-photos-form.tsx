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
      className="flex flex-wrap items-center gap-3"
    >
      <input
        ref={inputRef}
        type="file"
        name="images"
        accept={FORMATOS_ACEITOS}
        multiple
        required
        disabled={busy}
        className="text-sm text-muted file:mr-3 file:rounded-full file:border file:border-border file:bg-transparent file:px-4 file:py-2 file:text-sm file:text-foreground"
      />
      <button
        type="submit"
        disabled={busy}
        className="h-10 rounded-full border border-border px-5 text-sm font-medium hover:border-foreground disabled:opacity-50"
      >
        {busy ? "Enviando…" : "Enviar fotos"}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}
