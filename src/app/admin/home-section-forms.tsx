"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createHomeSectionAction,
  toggleHomeSectionAction,
  moveHomeSectionAction,
  deleteHomeSectionAction,
  type ActionResult,
} from "./actions";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import { KIND_LABEL, type HomeSectionKind } from "@/lib/home-sections";

const KINDS: HomeSectionKind[] = ["aviso", "banner", "mosaico", "vitrine"];

export function AddHomeSectionForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    createHomeSectionAction,
    null,
  );
  const { showToast } = useToast();
  const router = useRouter();
  useEffect(() => {
    if (state?.error) showToast(state.error, "error");
    // A lista é a mesma rota do formulário: sem o refresh o bloco novo só
    // apareceria depois de um F5.
    else if (state?.ok) {
      showToast("Bloco criado");
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="text-xs text-muted">
        Tipo de bloco
        <select
          name="kind"
          defaultValue="banner"
          className="mt-1 block w-56 rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton
        pendingText="Criando…"
        className="h-9 rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
      >
        + Adicionar bloco
      </SubmitButton>
    </form>
  );
}

export function SectionRowActions({
  id,
  active,
  isFirst,
  isLast,
}: {
  id: string;
  active: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /**
   * Roda a ação e recarrega a lista. Estas ações são disparadas DA PRÓPRIA
   * página da lista: só `revalidatePath` no servidor (ou um `redirect` para a
   * mesma URL) não troca o que está na tela — o router reaproveita o cache.
   */
  function run(
    fn: (formData: FormData) => Promise<void>,
    formData: FormData,
  ) {
    startTransition(async () => {
      await fn(formData);
      router.refresh();
    });
  }

  const btn =
    "flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm transition-colors hover:border-foreground disabled:opacity-30";

  return (
    <div
      className={`flex items-center gap-2 transition-opacity ${
        pending ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <form action={(fd) => run(moveHomeSectionAction, fd)}>
        <input type="hidden" name="sectionId" value={id} />
        <input type="hidden" name="dir" value="up" />
        <button
          type="submit"
          disabled={isFirst || pending}
          aria-label="Mover para cima"
          className={btn}
        >
          ↑
        </button>
      </form>
      <form action={(fd) => run(moveHomeSectionAction, fd)}>
        <input type="hidden" name="sectionId" value={id} />
        <input type="hidden" name="dir" value="down" />
        <button
          type="submit"
          disabled={isLast || pending}
          aria-label="Mover para baixo"
          className={btn}
        >
          ↓
        </button>
      </form>
      <form action={(fd) => run(toggleHomeSectionAction, fd)}>
        <input type="hidden" name="sectionId" value={id} />
        <SubmitButton
          pendingText="…"
          disabled={pending}
          className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${
            active
              ? "border-green-600 text-green-700 dark:text-green-400"
              : "border-border text-muted hover:border-foreground"
          }`}
        >
          {active ? "No ar" : "Oculto"}
        </SubmitButton>
      </form>
    </div>
  );
}

export function DeleteHomeSectionButton({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  return (
    <form
      action={deleteHomeSectionAction}
      onSubmit={(e) => {
        if (!window.confirm(`Excluir o bloco "${label}"?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="sectionId" value={id} />
      <SubmitButton
        pendingText="Excluindo…"
        className="text-xs text-red-600 underline-offset-4 hover:underline dark:text-red-400"
      >
        Excluir
      </SubmitButton>
    </form>
  );
}
