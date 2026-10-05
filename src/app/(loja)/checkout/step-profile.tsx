"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import {
  isFullName,
  isValidCpf,
  isValidPhone,
  maskCpf,
  maskPhone,
} from "@/lib/customer-fields";
import { saveCheckoutProfileAction } from "./actions";

/**
 * Passo 3: nome, CPF e telefone — o mínimo que o pagamento exige
 * (`perfilCompleto`, a mesma regra que o servidor aplica). Máscara enquanto
 * digita e validação no `blur` e no envio, com as MESMAS funções do servidor:
 * se só o servidor validasse, o cliente descobriria o CPF errado depois do
 * toque; se só a tela validasse, dado torto entraria com o JS desligado.
 *
 * Campos controlados e próprios do checkout (não o `ProfileForm` de /conta):
 * aquele aceita campo vazio e recarrega a página para mostrar o resultado.
 */

type Campo = "fullName" | "cpf" | "phone";
type Perfil = { fullName: string; cpf: string; phone: string };

const campo =
  "h-12 w-full rounded-xs border border-border bg-transparent px-4 text-base outline-none transition-colors focus:border-foreground aria-[invalid=true]:border-red-600 sm:text-sm";
const rotulo = "block text-sm font-medium";

const MSG: Record<Campo, string> = {
  fullName: "Informe nome e sobrenome.",
  cpf: "CPF inválido. Confira os números.",
  phone: "Telefone inválido. Use DDD e número.",
};

function erroDo(c: Campo, v: string): string | undefined {
  if (c === "fullName") return isFullName(v) ? undefined : MSG.fullName;
  if (c === "cpf") return isValidCpf(v) ? undefined : MSG.cpf;
  return isValidPhone(v) ? undefined : MSG.phone;
}

export function StepProfile({
  inicial,
  onSaved,
  onCancel,
  onNeedsLogin,
}: {
  inicial: { fullName?: string | null; cpf?: string | null; phone?: string | null } | null;
  onSaved: (p: Perfil) => void;
  /** Só quando o perfil já estava completo (o cliente abriu para trocar). */
  onCancel?: () => void;
  onNeedsLogin: () => void;
}) {
  const uid = useId();
  const id = (c: string) => `${uid}-${c}`;

  const [v, setV] = useState<Perfil>(() => ({
    fullName: inicial?.fullName ?? "",
    // Dado antigo pode estar sem máscara ("12345678909"): a máscara o arruma.
    cpf: maskCpf(inicial?.cpf ?? ""),
    phone: maskPhone(inicial?.phone ?? ""),
  }));
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nomeRef = useRef<HTMLInputElement>(null);
  const cpfRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const focar = (c: Campo) =>
    ({ fullName: nomeRef, cpf: cpfRef, phone: phoneRef })[c].current?.focus();

  function mudar(c: Campo, valor: string) {
    const novo =
      c === "cpf" ? maskCpf(valor) : c === "phone" ? maskPhone(valor) : valor;
    setV((p) => ({ ...p, [c]: novo }));
    // Erro some enquanto corrige; volta (se for o caso) no próximo `blur`.
    if (erros[c]) setErros((e) => ({ ...e, [c]: undefined }));
  }

  function noBlur(c: Campo) {
    // Campo vazio no primeiro passe não é erro — é só quem ainda não chegou lá.
    if (!v[c].trim()) return;
    setErros((e) => ({ ...e, [c]: erroDo(c, v[c]) }));
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy) return;
    setFormError(null);
    const e: Partial<Record<Campo, string>> = {
      fullName: erroDo("fullName", v.fullName),
      cpf: erroDo("cpf", v.cpf),
      phone: erroDo("phone", v.phone),
    };
    setErros(e);
    const primeiro = (["fullName", "cpf", "phone"] as Campo[]).find((c) => e[c]);
    if (primeiro) {
      focar(primeiro);
      return;
    }

    setBusy(true);
    try {
      const res = await saveCheckoutProfileAction(v);
      if (res.ok) {
        onSaved(res.profile);
        return;
      }
      if (res.needsLogin) {
        onNeedsLogin();
        return;
      }
      if (res.field) {
        const f = res.field;
        setErros({ [f]: res.error });
        focar(f);
      } else setFormError(res.error);
    } catch {
      setFormError("Não foi possível salvar seus dados. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  function erro(c: Campo) {
    if (!erros[c]) return null;
    return (
      <p id={id(`${c}-erro`)} role="alert" className="text-sm text-red-600 dark:text-red-400">
        {erros[c]}
      </p>
    );
  }

  const desc = (c: Campo) => (erros[c] ? id(`${c}-erro`) : undefined);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={id("fullName")} className={rotulo}>
          Nome completo
        </label>
        <input
          ref={nomeRef}
          id={id("fullName")}
          name="name"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="next"
          value={v.fullName}
          onChange={(e) => mudar("fullName", e.target.value)}
          onBlur={() => noBlur("fullName")}
          aria-invalid={!!erros.fullName || undefined}
          aria-describedby={desc("fullName")}
          className={campo}
        />
        {erro("fullName")}
      </div>

      <div className="space-y-1.5">
        <label htmlFor={id("cpf")} className={rotulo}>
          CPF
        </label>
        <input
          ref={cpfRef}
          id={id("cpf")}
          name="cpf"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="next"
          placeholder="000.000.000-00"
          value={v.cpf}
          onChange={(e) => mudar("cpf", e.target.value)}
          onBlur={() => noBlur("cpf")}
          aria-invalid={!!erros.cpf || undefined}
          aria-describedby={desc("cpf")}
          className={campo}
        />
        {erro("cpf")}
      </div>

      <div className="space-y-1.5">
        <label htmlFor={id("phone")} className={rotulo}>
          Telefone
        </label>
        <input
          ref={phoneRef}
          id={id("phone")}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          enterKeyHint="done"
          placeholder="(47) 99999-9999"
          value={v.phone}
          onChange={(e) => mudar("phone", e.target.value)}
          onBlur={() => noBlur("phone")}
          aria-invalid={!!erros.phone || undefined}
          aria-describedby={desc("phone")}
          className={campo}
        />
        {erro("phone")}
      </div>

      <p className="text-sm text-muted">
        O CPF vai na nota e o telefone é só para falar do seu pedido.
      </p>

      {formError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-12 w-full items-center justify-center rounded-xs bg-foreground px-8 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Salvando…" : "Continuar"}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mx-auto flex min-h-11 items-center text-sm text-muted underline underline-offset-4 hover:text-foreground"
        >
          Cancelar
        </button>
      )}
    </form>
  );
}
