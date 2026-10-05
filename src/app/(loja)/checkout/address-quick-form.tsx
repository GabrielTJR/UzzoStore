"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useCart } from "@/lib/cart-store";
import {
  cleanText,
  isValidUf,
  maskCep,
  onlyDigits,
  UFS,
} from "@/lib/customer-fields";
import { saveCheckoutAddressAction } from "./actions";
import type { CustomerAddress } from "@/lib/customer";

/**
 * Endereço rápido do checkout: CEP + número + complemento. Rua, bairro e
 * cidade vêm do ViaCEP e só viram campos quando o ViaCEP não resolve — no
 * celular, cada campo a menos é gente a menos desistindo.
 *
 * O ViaCEP é chamado DO NAVEGADOR (como em /conta/enderecos): o frete é cotado
 * só pelo CEP, então uma cidade escrita diferente não muda preço, e uma ida ao
 * servidor só para isso seria chamada externa a mais no passo de conversão.
 * Um disparo por CEP completo (nunca por tecla, nunca no `blur`), com
 * `AbortController`: quem corrige o último dígito cancela a consulta anterior.
 *
 * O frete NÃO é cotado aqui: só depois de "Usar este endereço" salvar a linha.
 * A cotação do pedido sai do endereço gravado na conta, e é ele que o servidor
 * confere — cotar o CEP digitado mostraria um preço que o pagamento recota.
 */

type Campo = "cep" | "street" | "number" | "city" | "state";
type ViaCep = "idle" | "buscando" | "ok" | "falha" | "naoachou";

const campo =
  "h-12 w-full rounded-xs border border-border bg-transparent px-4 text-base outline-none transition-colors focus:border-foreground aria-[invalid=true]:border-red-600 sm:text-sm";
const rotulo = "block text-sm font-medium";
const erroCls = "text-sm text-red-600 dark:text-red-400";

export function AddressQuickForm({
  onSaved,
  onCancel,
  onNeedsLogin,
}: {
  onSaved: (a: CustomerAddress) => void;
  /** Só existe quando já há endereço salvo para onde voltar. */
  onCancel?: () => void;
  onNeedsLogin: () => void;
}) {
  const uid = useId();
  const id = (c: string) => `${uid}-${c}`;

  // Pré-preenchido UMA vez com o último CEP cotado (sacola ou produto). O
  // formulário só monta depois da hidratação (o fluxo tem guarda), então o
  // localStorage já está lido aqui e não há divergência com o servidor.
  const [cepInicial] = useState(() => maskCep(useCart.getState().cep ?? ""));
  const [cep, setCep] = useState(cepInicial);
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [street, setStreet] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [via, setVia] = useState<ViaCep>(() =>
    onlyDigits(cepInicial).length === 8 ? "buscando" : "idle",
  );
  /** Rua/bairro/cidade/UF como campos (ViaCEP falhou ou o cliente quis editar). */
  const [manual, setManual] = useState(false);
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const controller = useRef<AbortController | null>(null);
  const ultimoCep = useRef<string | null>(null);
  const cepRef = useRef<HTMLInputElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const streetRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLSelectElement>(null);
  /** Foca o campo com erro — depois do render, porque ele pode ter acabado
   * de aparecer (rua/cidade só existem no modo manual). */
  function focar(c: Campo) {
    const alvo = {
      cep: cepRef,
      number: numberRef,
      street: streetRef,
      city: cityRef,
      state: stateRef,
    }[c];
    requestAnimationFrame(() => alvo.current?.focus());
  }

  /** Consulta o ViaCEP. Todo `setState` acontece depois do `await`. */
  async function consultar(d: string) {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    ultimoCep.current = d;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`, {
        signal: c.signal,
      });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as {
        erro?: boolean | string;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (c.signal.aborted || ultimoCep.current !== d) return;
      if (j.erro) {
        setVia("naoachou");
        setManual(true);
        return;
      }
      setStreet(j.logradouro ?? "");
      setDistrict(j.bairro ?? "");
      setCity(j.localidade ?? "");
      setUf((j.uf ?? "").toUpperCase());
      setVia("ok");
      // CEP geral de cidade pequena não traz rua: aí o cliente escreve.
      setManual(!j.logradouro);
      setErros((e) => ({ ...e, cep: undefined, street: undefined, city: undefined, state: undefined }));
    } catch {
      if (c.signal.aborted || ultimoCep.current !== d) return;
      setVia("falha");
      setManual(true);
    }
  }

  // CEP que já veio da sacola: consulta uma vez ao montar.
  useEffect(() => {
    const d = onlyDigits(cepInicial);
    // `consultar` só mexe no estado depois do `await` (o lint não enxerga).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (d.length === 8) void consultar(d);
    return () => controller.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na montagem
  }, []);

  function handleCep(valor: string) {
    const masked = maskCep(valor);
    setCep(masked);
    setErros((e) => ({ ...e, cep: undefined }));
    const d = onlyDigits(masked);
    if (d.length === 8) {
      if (d === ultimoCep.current) return;
      setVia("buscando");
      void consultar(d);
      return;
    }
    // CEP mexido: o endereço que o ViaCEP trouxe era de outro CEP.
    if (ultimoCep.current) {
      controller.current?.abort();
      ultimoCep.current = null;
      setVia("idle");
      setManual(false);
      setStreet("");
      setDistrict("");
      setCity("");
      setUf("");
    }
  }

  function validar(): Partial<Record<Campo, string>> {
    const e: Partial<Record<Campo, string>> = {};
    if (onlyDigits(cep).length !== 8) e.cep = "Digite os 8 números do CEP.";
    if (!cleanText(number, 20))
      e.number = "Informe o número (ou toque em sem número).";
    if (cleanText(street, 120).length < 2) e.street = "Informe a rua.";
    if (cleanText(city, 80).length < 2) e.city = "Informe a cidade.";
    if (!isValidUf(uf)) e.state = "Escolha o estado.";
    return e;
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy) return;
    setFormError(null);
    const e = validar();
    // Rua/cidade/UF com erro e escondidas: abre os campos para o cliente ver.
    if ((e.street || e.city || e.state) && via !== "buscando") setManual(true);
    setErros(e);
    const primeiro = (["cep", "number", "street", "city", "state"] as Campo[]).find(
      (c) => e[c],
    );
    if (primeiro) {
      if (via === "buscando" && primeiro !== "cep" && primeiro !== "number") {
        setFormError("Aguarde: estamos buscando o endereço pelo CEP.");
        return;
      }
      focar(primeiro);
      return;
    }

    setBusy(true);
    try {
      const res = await saveCheckoutAddressAction({
        cep: onlyDigits(cep),
        street,
        number,
        complement: complement || null,
        district: district || null,
        city,
        state: uf,
      });
      if (res.ok) {
        onSaved(res.address);
        return;
      }
      if (res.needsLogin) {
        onNeedsLogin();
        return;
      }
      if (res.field) {
        const f = res.field;
        if (f === "street" || f === "city" || f === "state") setManual(true);
        setErros({ [f]: res.error });
        focar(f);
      } else setFormError(res.error);
    } catch {
      setFormError("Não foi possível salvar o endereço. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  const desc = (c: Campo) => (erros[c] ? id(`${c}-erro`) : undefined);
  const erroDe = (c: Campo) =>
    erros[c] ? (
      <p id={id(`${c}-erro`)} role="alert" className={erroCls}>
        {erros[c]}
      </p>
    ) : null;

  const linhaEndereco = [
    street,
    district,
    city && uf ? `${city}/${uf}` : city || uf,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor={id("cep")} className={rotulo}>
            CEP
          </label>
          <input
            ref={cepRef}
            id={id("cep")}
            name="cep"
            inputMode="numeric"
            autoComplete="postal-code"
            enterKeyHint="next"
            placeholder="00000-000"
            value={cep}
            onChange={(e) => handleCep(e.target.value)}
            aria-invalid={!!erros.cep || undefined}
            aria-describedby={desc("cep")}
            className={campo}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={id("number")} className={rotulo}>
            Número
          </label>
          <input
            ref={numberRef}
            id={id("number")}
            name="number"
            autoComplete="address-line2"
            enterKeyHint="next"
            value={number}
            onChange={(e) => {
              setNumber(e.target.value);
              setErros((x) => ({ ...x, number: undefined }));
            }}
            aria-invalid={!!erros.number || undefined}
            aria-describedby={desc("number")}
            className={campo}
          />
        </div>
      </div>
      {erroDe("cep")}
      {erroDe("number")}
      {number.trim().toLowerCase() !== "s/n" && (
        <button
          type="button"
          onClick={() => {
            setNumber("s/n");
            setErros((x) => ({ ...x, number: undefined }));
          }}
          className="-mt-2 inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4 hover:text-foreground"
        >
          Endereço sem número
        </button>
      )}

      {/* Resultado do ViaCEP */}
      {via === "buscando" && (
        <p role="status" className="text-sm text-muted">
          Buscando endereço…
        </p>
      )}
      {via === "naoachou" && (
        <p role="alert" className={erroCls}>
          CEP não encontrado. Confira os números.
        </p>
      )}
      {via === "falha" && (
        <p role="status" className="text-sm text-muted">
          Não conseguimos buscar o endereço pelo CEP. Preencha abaixo.
        </p>
      )}
      {via === "ok" && !manual && (
        <p className="text-sm text-muted">
          {linhaEndereco}.{" "}
          <button
            type="button"
            onClick={() => setManual(true)}
            className="inline-flex min-h-11 items-center align-middle underline underline-offset-4 hover:text-foreground"
          >
            editar<span className="sr-only"> rua, bairro e cidade</span>
          </button>
        </p>
      )}

      {manual && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={id("street")} className={rotulo}>
              Rua
            </label>
            <input
              ref={streetRef}
              id={id("street")}
              name="street"
              autoComplete="address-line1"
              value={street}
              onChange={(e) => {
                setStreet(e.target.value);
                setErros((x) => ({ ...x, street: undefined }));
              }}
              aria-invalid={!!erros.street || undefined}
              aria-describedby={desc("street")}
              className={campo}
            />
            {erroDe("street")}
          </div>
          <div className="space-y-1.5">
            <label htmlFor={id("district")} className={rotulo}>
              Bairro
            </label>
            <input
              id={id("district")}
              name="district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className={campo}
            />
          </div>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <div className="space-y-1.5">
              <label htmlFor={id("city")} className={rotulo}>
                Cidade
              </label>
              <input
                ref={cityRef}
                id={id("city")}
                name="city"
                autoComplete="address-level2"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setErros((x) => ({ ...x, city: undefined }));
                }}
                aria-invalid={!!erros.city || undefined}
                aria-describedby={desc("city")}
                className={campo}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={id("state")} className={rotulo}>
                Estado
              </label>
              <select
                ref={stateRef}
                id={id("state")}
                name="state"
                autoComplete="address-level1"
                value={uf}
                onChange={(e) => {
                  setUf(e.target.value);
                  setErros((x) => ({ ...x, state: undefined }));
                }}
                aria-invalid={!!erros.state || undefined}
                aria-describedby={desc("state")}
                className={`${campo} px-3`}
              >
                <option value="">UF</option>
                {UFS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {erroDe("city")}
          {erroDe("state")}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor={id("complement")} className={rotulo}>
          Complemento <span className="font-normal text-muted">(opcional)</span>
        </label>
        <input
          id={id("complement")}
          name="complement"
          autoComplete="off"
          placeholder="Apartamento, bloco, sala"
          value={complement}
          onChange={(e) => setComplement(e.target.value)}
          className={campo}
        />
      </div>

      {formError && (
        <p role="alert" className={erroCls}>
          {formError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-xs border border-foreground px-6 text-sm font-medium transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
        >
          {busy ? "Salvando…" : "Usar este endereço"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4 hover:text-foreground"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
