"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createColorAction,
  updateColorAction,
  deleteColorAction,
  type ActionResult,
} from "./actions";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import type { ColorOption } from "@/lib/admin-products";

const field =
  "rounded-xs border border-border bg-transparent px-3 text-sm outline-none focus:border-foreground";

export function NewColorForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    createColorAction,
    null,
  );
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      showToast("Cor cadastrada");
      formRef.current?.reset();
    } else if (state?.error) showToast(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="flex items-end gap-2">
        <label className="block flex-1 text-sm font-medium">
          Nome da cor
          <input
            name="name"
            required
            placeholder="Ex.: Azul marinho"
            className={`${field} mt-1.5 block h-10 w-full font-normal`}
          />
        </label>
        <label className="block text-sm font-medium">
          <span className="sr-only">Amostra</span>
          <input
            type="color"
            name="hex"
            defaultValue="#000000"
            aria-label="Cor da amostra"
            className="block h-10 w-12 cursor-pointer rounded-xs border border-border bg-transparent"
          />
        </label>
      </div>
      <SubmitButton
        pendingText="Salvando…"
        className="h-10 w-full rounded-xs bg-foreground text-sm font-semibold text-background hover:opacity-90"
      >
        Cadastrar cor
      </SubmitButton>
    </form>
  );
}

/**
 * Uma cor como cartão: amostra grande, nome, quantas peças usam.
 *
 * Cor SEM amostra não ganha o seletor de cara: o `<input type="color">` não
 * tem "vazio" (mostra preto), e salvar só o nome gravaria preto na bolinha de
 * todas as peças dessa cor. O seletor só entra quando a pessoa pede.
 */
export function ColorCard({
  color,
  usage,
}: {
  color: ColorOption;
  usage: number;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    updateColorAction,
    null,
  );
  const { showToast } = useToast();
  const [escolher, setEscolher] = useState(!!color.hex);
  const [hex, setHex] = useState(color.hex ?? "#000000");

  useEffect(() => {
    if (state?.ok) showToast("Cor atualizada");
    else if (state?.error) showToast(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <li className="flex flex-col rounded-sm border border-border bg-background">
      <div
        className="relative h-16 rounded-t-sm border-b border-border"
        style={
          escolher
            ? { background: hex }
            : {
                background:
                  "repeating-linear-gradient(45deg, var(--surface) 0 6px, transparent 6px 12px)",
              }
        }
      >
        {!escolher && (
          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-muted">
            Sem amostra
          </span>
        )}
      </div>
      <form action={action} className="flex flex-1 flex-col gap-2 p-3">
        <input type="hidden" name="colorId" value={color.id} />
        <input
          name="name"
          required
          defaultValue={color.name}
          aria-label="Nome da cor"
          className={`${field} h-9 w-full font-medium`}
        />
        <div className="flex items-center gap-2">
          {escolher ? (
            <input
              type="color"
              name="hex"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              aria-label={`Amostra de ${color.name}`}
              className="h-9 w-12 shrink-0 cursor-pointer rounded-xs border border-border bg-transparent"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEscolher(true)}
              className="h-9 shrink-0 rounded-xs border border-dashed border-border px-2 text-xs font-medium hover:border-foreground"
            >
              Escolher amostra
            </button>
          )}
          <SubmitButton
            pendingText="…"
            className="ml-auto h-9 rounded-xs border border-border px-3 text-sm font-medium hover:border-foreground"
          >
            Salvar
          </SubmitButton>
        </div>
      </form>
      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs">
        <span className="text-muted">
          {usage > 0
            ? `${usage} ${usage === 1 ? "produto" : "produtos"}`
            : "Sem uso"}
        </span>
        {usage === 0 ? (
          <form
            action={deleteColorAction}
            onSubmit={(e) => {
              if (!window.confirm(`Excluir a cor "${color.name}"?`))
                e.preventDefault();
            }}
          >
            <input type="hidden" name="colorId" value={color.id} />
            <SubmitButton
              pendingText="Excluindo…"
              className="text-red-600 underline-offset-4 hover:underline dark:text-red-400"
            >
              Excluir
            </SubmitButton>
          </form>
        ) : (
          <span
            title="Em uso por produtos — tire a cor deles antes de excluir"
            className="text-muted"
          >
            Em uso
          </span>
        )}
      </div>
    </li>
  );
}
