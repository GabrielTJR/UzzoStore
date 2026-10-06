"use client";

import {
  useActionState,
  useEffect,
  useId,
  useState,
  type FormEvent,
} from "react";
import {
  updateProfileAction,
  changeCustomerPasswordAction,
  type ActionResult,
} from "./actions";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import {
  isFullName,
  isValidCpf,
  isValidPhone,
  maskCpf,
  maskPhone,
  onlyDigits,
} from "@/lib/customer-fields";
import type { CustomerProfile } from "@/lib/customer";

const campo =
  "h-12 w-full rounded-xs border border-border bg-transparent px-4 text-base outline-none transition-colors focus:border-foreground aria-[invalid=true]:border-red-600 sm:text-sm";
const rotulo = "block text-sm font-medium";
const erroCls = "text-sm text-red-600 dark:text-red-400";
const primario =
  "inline-flex h-12 w-full items-center justify-center rounded-xs bg-foreground px-8 text-sm font-medium text-background hover:opacity-90 sm:w-auto";

type Campo = "fullName" | "cpf" | "phone";

/**
 * Dados pessoais. Máscara e validação com as MESMAS funções do checkout e da
 * action (`customer-fields.ts`): se a tela aceitasse um CPF que o checkout
 * recusa, o cliente só descobriria na hora de pagar.
 *
 * Campos controlados de propósito: o React 19 reseta o formulário depois de
 * uma action, e com `defaultValue` o que o cliente acabou de digitar voltaria
 * ao valor antigo na tela.
 */
export function ProfileForm({ profile }: { profile: CustomerProfile }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    updateProfileAction,
    null,
  );
  const { showToast } = useToast();
  useEffect(() => {
    if (state?.ok) showToast("Dados salvos");
    else if (state?.error) showToast(state.error, "error");
  }, [state, showToast]);

  const uid = useId();
  const id = (c: string) => `${uid}-${c}`;
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [cpf, setCpf] = useState(maskCpf(profile.cpf ?? ""));
  const [phone, setPhone] = useState(maskPhone(profile.phone ?? ""));
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});

  function validar(ev: FormEvent<HTMLFormElement>) {
    const e: Partial<Record<Campo, string>> = {};
    if (!isFullName(fullName)) e.fullName = "Informe nome e sobrenome.";
    // Vazio pode (a conta não é o checkout); preenchido tem de ser válido.
    if (onlyDigits(cpf) && !isValidCpf(cpf))
      e.cpf = "CPF inválido. Confira os números.";
    if (onlyDigits(phone) && !isValidPhone(phone))
      e.phone = "Telefone inválido. Use DDD e número.";
    if (!Object.keys(e).length) return;
    ev.preventDefault();
    setErros(e);
    const primeiro = (["fullName", "cpf", "phone"] as Campo[]).find(
      (c) => e[c],
    );
    if (primeiro) document.getElementById(id(primeiro))?.focus();
  }

  const erroDe = (c: Campo) =>
    erros[c] ? (
      <p id={id(`${c}-erro`)} role="alert" className={erroCls}>
        {erros[c]}
      </p>
    ) : null;
  const props = (c: Campo) => ({
    id: id(c),
    name: c,
    "aria-invalid": !!erros[c] || undefined,
    "aria-describedby": erros[c] ? id(`${c}-erro`) : undefined,
    className: campo,
  });
  const limpa = (c: Campo) => setErros((x) => ({ ...x, [c]: undefined }));

  return (
    <form action={action} onSubmit={validar} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <label className={rotulo} htmlFor={id("fullName")}>
          Nome completo
        </label>
        <input
          {...props("fullName")}
          autoComplete="name"
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            limpa("fullName");
          }}
        />
        {erroDe("fullName")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={rotulo} htmlFor={id("cpf")}>
            CPF
          </label>
          <input
            {...props("cpf")}
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => {
              setCpf(maskCpf(e.target.value));
              limpa("cpf");
            }}
          />
          {erroDe("cpf")}
        </div>
        <div className="space-y-1.5">
          <label className={rotulo} htmlFor={id("phone")}>
            Celular / WhatsApp
          </label>
          <input
            {...props("phone")}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(47) 99999-9999"
            value={phone}
            onChange={(e) => {
              setPhone(maskPhone(e.target.value));
              limpa("phone");
            }}
          />
          {erroDe("phone")}
        </div>
      </div>
      <p className="text-sm text-muted">
        CPF e celular são pedidos no pagamento pelo site — salvos aqui, o
        checkout já vem preenchido.
      </p>
      <SubmitButton pendingText="Salvando…" className={primario}>
        Salvar dados
      </SubmitButton>
    </form>
  );
}

/**
 * Senha. Quem comprou pelo checkout entrou por CÓDIGO e não conhece senha
 * nenhuma (a conta nasce com uma aleatória). Por isso a tela fala em
 * "definir", não em "trocar", e não pede a senha atual — a action
 * (`changeCustomerPasswordAction`) também não pede: estar logado basta.
 */
export function PasswordForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    changeCustomerPasswordAction,
    null,
  );
  const { showToast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (state?.ok) {
      showToast("Senha definida");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha depois do sucesso
      setAberto(false);
      setSenha("");
    } else if (state?.error) showToast(state.error, "error");
  }, [state, showToast]);

  if (!aberto)
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Entrou com um código por e-mail? Você pode criar uma senha para as
          próximas vezes — não precisa saber a anterior.
        </p>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="inline-flex h-12 w-full items-center justify-center rounded-xs border border-border px-6 text-sm font-medium transition-colors hover:border-foreground sm:w-auto"
        >
          Definir nova senha
        </button>
      </div>
    );

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (senha.length < 8) {
          e.preventDefault();
          setErro("A senha deve ter ao menos 8 caracteres.");
        }
      }}
      noValidate
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <label className={rotulo} htmlFor="nova-senha">
          Nova senha
        </label>
        <div className="relative">
          <input
            id="nova-senha"
            name="password"
            type={ver ? "text" : "password"}
            autoComplete="new-password"
            autoFocus
            value={senha}
            onChange={(e) => {
              setSenha(e.target.value);
              setErro(null);
            }}
            aria-invalid={!!erro || undefined}
            aria-describedby="nova-senha-dica"
            className={`${campo} pr-20`}
          />
          <button
            type="button"
            onClick={() => setVer((v) => !v)}
            className="absolute inset-y-0 right-0 px-4 text-sm text-muted hover:text-foreground"
          >
            {ver ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        <p
          id="nova-senha-dica"
          className={erro ? erroCls : "text-sm text-muted"}
        >
          {erro ?? "Mínimo de 8 caracteres."}
        </p>
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setSenha("");
            setErro(null);
          }}
          className="inline-flex h-12 items-center justify-center rounded-xs border border-border px-6 text-sm font-medium hover:border-foreground"
        >
          Cancelar
        </button>
        <SubmitButton pendingText="Salvando…" className={primario}>
          Salvar senha
        </SubmitButton>
      </div>
    </form>
  );
}
