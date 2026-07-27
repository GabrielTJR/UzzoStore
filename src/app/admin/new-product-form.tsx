"use client";

import { useActionState, useRef, useState } from "react";
import { createProductAction, type ActionResult } from "./actions";
import { uploadPhotos } from "@/lib/upload-photos";
import { CATEGORIES } from "@/lib/categories";

const initialState: ActionResult | null = null;

export function NewProductForm() {
  const [state, formAction, pending] = useActionState(
    createProductAction,
    initialState,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imagePathRef = useRef<HTMLInputElement>(null);
  const preparedRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Envia a foto (se houver) DIRETO ao Storage antes de submeter o formulário,
  // e injeta só o caminho no campo oculto — os bytes não trafegam pela action.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const file = fileRef.current?.files?.[0];
    if (!file || preparedRef.current) return; // sem foto, ou já enviada: segue o fluxo normal

    e.preventDefault();
    setUploadError(null);
    setUploading(true);
    try {
      const { paths } = await uploadPhotos([file], "pending");
      if (paths.length === 0) {
        setUploadError("Falha ao enviar a foto. Tente novamente.");
        return;
      }
      if (imagePathRef.current) imagePathRef.current.value = paths[0];
      if (fileRef.current) fileRef.current.value = ""; // não enviar os bytes no corpo
      preparedRef.current = true;
      formRef.current?.requestSubmit();
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Falha ao enviar a foto.",
      );
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || pending;

  const field =
    "w-full rounded-md border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-foreground";
  const label = "block text-sm font-medium";

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <input type="hidden" name="imagePath" ref={imagePathRef} />
      <div className="space-y-1.5">
        <label className={label} htmlFor="name">
          Nome do produto *
        </label>
        <input id="name" name="name" required className={field} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={label} htmlFor="category">
            Categoria
          </label>
          <select id="category" name="category" defaultValue="" className={field}>
            <option value="" disabled>
              Selecione…
            </option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={label} htmlFor="reference">
            Referência / SKU
          </label>
          <input id="reference" name="reference" className={field} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={label} htmlFor="price">
            Preço (R$) *
          </label>
          <input
            id="price"
            name="price"
            required
            inputMode="decimal"
            placeholder="129,90"
            className={field}
          />
        </div>
        <div className="space-y-1.5">
          <label className={label} htmlFor="sizes">
            Tamanhos *
          </label>
          <input
            id="sizes"
            name="sizes"
            required
            placeholder="P, M, G"
            className={field}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={label} htmlFor="description">
          Descrição
        </label>
        <textarea id="description" name="description" rows={3} className={field} />
      </div>

      <div className="space-y-1.5">
        <label className={label} htmlFor="image">
          Foto do produto
        </label>
        <input
          id="image"
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={() => {
            preparedRef.current = false;
          }}
          className="block w-full text-sm text-muted file:mr-4 file:rounded-full file:border file:border-border file:bg-transparent file:px-4 file:py-2 file:text-sm file:text-foreground"
        />
        <p className="text-xs text-muted">
          Opcional agora — dá para adicionar/trocar a foto depois.
        </p>
      </div>

      {(uploadError || state?.error) && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {uploadError ?? state?.error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="h-11 rounded-full bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Salvando…" : "Cadastrar produto"}
      </button>
    </form>
  );
}
