"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  saveAddressAction,
  deleteAddressAction,
  type ActionResult,
} from "../actions";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import {
  cleanText,
  isValidUf,
  maskCep,
  onlyDigits,
  UFS,
} from "@/lib/customer-fields";
import type { CustomerAddress } from "@/lib/customer";

/**
 * Endereços da conta: cartões + formulário que abre no lugar (editar) ou no
 * fim da lista (adicionar). Um só aberto por vez — no celular dois
 * formulários empilhados viram uma tela sem fim.
 *
 * O formulário segue o do checkout (`checkout/address-quick-form.tsx`): CEP e
 * número primeiro, rua/bairro/cidade do ViaCEP e só viram campos quando ele
 * não resolve ou o cliente pede para editar. Não dá para reusar aquele
 * componente: ele grava pela action do checkout e lê o CEP da sacola. Aqui a
 * gravação continua sendo `saveAddressAction` (client com cookie — o RLS
 * isola), com a mesma regra de "um principal só".
 */

const campo =
  "h-12 w-full rounded-xs border border-border bg-transparent px-4 text-base outline-none transition-colors focus:border-foreground aria-[invalid=true]:border-red-600 sm:text-sm";
const rotulo = "block text-sm font-medium";
const erroCls = "text-sm text-red-600 dark:text-red-400";
const primario =
  "inline-flex h-12 items-center justify-center rounded-xs bg-foreground px-6 text-sm font-medium text-background hover:opacity-90";
const secundario =
  "inline-flex h-12 items-center justify-center rounded-xs border border-border px-6 text-sm font-medium transition-colors hover:border-foreground";

type Campo = "cep" | "number" | "street" | "city" | "state";
type ViaCep = "idle" | "buscando" | "ok" | "falha" | "naoachou";

function useResultToast(
  state: ActionResult | null,
  ok: string,
  onOk?: () => void,
) {
  const { showToast } = useToast();
  useEffect(() => {
    if (state?.ok) {
      showToast(ok);
      onOk?.();
    } else if (state?.error) showToast(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o resultado muda
  }, [state]);
}

export function AddressForm({
  address,
  forceDefault = false,
  onDone,
  onCancel,
}: {
  address?: CustomerAddress;
  /** Primeiro endereço da conta já nasce principal. */
  forceDefault?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    saveAddressAction,
    null,
  );
  useResultToast(state, "Endereço salvo", onDone);

  const uid = useId();
  const id = (c: string) => `${uid}-${c}`;

  const [cep, setCep] = useState(maskCep(address?.cep ?? ""));
  const [number, setNumber] = useState(address?.number ?? "");
  const [complement, setComplement] = useState(address?.complement ?? "");
  const [street, setStreet] = useState(address?.street ?? "");
  const [district, setDistrict] = useState(address?.district ?? "");
  const [city, setCity] = useState(address?.city ?? "");
  const [uf, setUf] = useState((address?.state ?? "").toUpperCase());
  const [labelTxt, setLabelTxt] = useState(address?.label ?? "");
  // Editando, o endereço já está completo: mostra a linha resumida, como se o
  // ViaCEP tivesse acabado de responder.
  const [via, setVia] = useState<ViaCep>(address ? "ok" : "idle");
  const [manual, setManual] = useState(false);
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});

  const controller = useRef<AbortController | null>(null);
  const ultimoCep = useRef<string | null>(
    address ? onlyDigits(address.cep) : null,
  );
  const cepRef = useRef<HTMLInputElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const streetRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLSelectElement>(null);
  /** Foca depois do render: rua/cidade podem ter acabado de aparecer. */
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

  useEffect(() => () => controller.current?.abort(), []);

  /** Um disparo por CEP completo, com AbortController (mesma regra do checkout). */
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
      setManual(!j.logradouro); // CEP geral de cidade pequena não traz rua
      setErros((e) => ({
        ...e,
        cep: undefined,
        street: undefined,
        city: undefined,
        state: undefined,
      }));
      numberRef.current?.focus(); // o número é o que sempre falta
    } catch {
      if (c.signal.aborted || ultimoCep.current !== d) return;
      setVia("falha");
      setManual(true);
    }
  }

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
    // CEP mexido: o endereço que estava ali era de outro CEP.
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

  function validar(ev: FormEvent<HTMLFormElement>) {
    const e: Partial<Record<Campo, string>> = {};
    if (onlyDigits(cep).length !== 8) e.cep = "Digite os 8 números do CEP.";
    if (!cleanText(number, 20))
      e.number = "Informe o número (ou toque em sem número).";
    if (cleanText(street, 120).length < 2) e.street = "Informe a rua.";
    if (cleanText(city, 80).length < 2) e.city = "Informe a cidade.";
    if (!isValidUf(uf)) e.state = "Escolha o estado.";
    const primeiro = (
      ["cep", "number", "street", "city", "state"] as Campo[]
    ).find((c) => e[c]);
    if (!primeiro) return;
    ev.preventDefault();
    if ((e.street || e.city || e.state) && via !== "buscando") setManual(true);
    setErros(e);
    focar(primeiro);
  }

  const desc = (c: Campo) => (erros[c] ? id(`${c}-erro`) : undefined);
  const erroDe = (c: Campo) =>
    erros[c] ? (
      <p id={id(`${c}-erro`)} role="alert" className={erroCls}>
        {erros[c]}
      </p>
    ) : null;
  const limpaErro = (c: Campo) => setErros((x) => ({ ...x, [c]: undefined }));

  const linhaEndereco = [
    street,
    district,
    city && uf ? `${city}/${uf}` : city || uf,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <form
      action={action}
      onSubmit={validar}
      noValidate
      className="space-y-4 rounded-sm border border-foreground p-4 sm:p-5"
    >
      <p className="font-semibold">
        {address ? "Editar endereço" : "Novo endereço"}
      </p>
      {address && <input type="hidden" name="addressId" value={address.id} />}

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
            value={number}
            onChange={(e) => {
              setNumber(e.target.value);
              limpaErro("number");
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
            limpaErro("number");
          }}
          className="-mt-2 inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4 hover:text-foreground"
        >
          Endereço sem número
        </button>
      )}

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

      {manual ? (
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
                limpaErro("street");
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
                  limpaErro("city");
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
                  limpaErro("state");
                }}
                aria-invalid={!!erros.state || undefined}
                aria-describedby={desc("state")}
                className={campo}
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
      ) : (
        // Recolhidos, os campos do ViaCEP seguem no envio.
        <>
          <input type="hidden" name="street" value={street} />
          <input type="hidden" name="district" value={district} />
          <input type="hidden" name="city" value={city} />
          <input type="hidden" name="state" value={uf} />
        </>
      )}

      <div className="space-y-1.5">
        <label htmlFor={id("complement")} className={rotulo}>
          Complemento <span className="font-normal text-muted">(opcional)</span>
        </label>
        <input
          id={id("complement")}
          name="complement"
          placeholder="Apto, bloco, referência"
          value={complement}
          onChange={(e) => setComplement(e.target.value)}
          className={campo}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor={id("label")} className={rotulo}>
          Nome do endereço{" "}
          <span className="font-normal text-muted">(opcional)</span>
        </label>
        <input
          id={id("label")}
          name="label"
          placeholder="Casa, trabalho…"
          maxLength={40}
          value={labelTxt}
          onChange={(e) => setLabelTxt(e.target.value)}
          className={campo}
        />
      </div>

      {forceDefault ? (
        <input type="hidden" name="isDefault" value="on" />
      ) : (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="isDefault"
            defaultChecked={address?.isDefault ?? false}
            className="h-5 w-5 accent-foreground"
          />
          Usar como endereço principal
        </label>
      )}

      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row">
        {onCancel && (
          <button type="button" onClick={onCancel} className={secundario}>
            Cancelar
          </button>
        )}
        <SubmitButton
          pendingText="Salvando…"
          className={`${primario} sm:min-w-48`}
        >
          {address ? "Salvar endereço" : "Adicionar endereço"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** "Tornar principal" regrava o endereço com `isDefault` — a action já
 * garante um principal só, então não precisa de action nova. */
function MakeDefaultButton({ address }: { address: CustomerAddress }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    saveAddressAction,
    null,
  );
  useResultToast(state, "Endereço principal atualizado");
  const campos: Record<string, string> = {
    addressId: address.id,
    label: address.label ?? "",
    cep: address.cep,
    street: address.street,
    number: address.number ?? "",
    complement: address.complement ?? "",
    district: address.district ?? "",
    city: address.city,
    state: address.state,
    isDefault: "on",
  };
  return (
    <form action={action}>
      {Object.entries(campos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton
        pendingText="Salvando…"
        className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-foreground"
      >
        Tornar principal
      </SubmitButton>
    </form>
  );
}

export function AddressCard({
  address,
  onEdit,
}: {
  address: CustomerAddress;
  onEdit: () => void;
}) {
  return (
    <article
      className={`flex flex-col rounded-sm border p-4 sm:p-5 ${
        address.isDefault ? "border-foreground" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{address.label || "Endereço"}</p>
        {address.isDefault && (
          <span className="shrink-0 rounded-xs bg-foreground px-2 py-1 text-xs font-medium leading-none text-background">
            Principal
          </span>
        )}
      </div>
      <div className="mt-2 flex-1 text-sm text-muted">
        <p>
          {[address.street, address.number].filter(Boolean).join(", ")}
          {address.complement ? ` — ${address.complement}` : ""}
        </p>
        <p>
          {address.district ? `${address.district}, ` : ""}
          {address.city}/{address.state}
        </p>
        <p>CEP {address.cep}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 border-t border-border pt-2">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-foreground"
        >
          Editar
        </button>
        {!address.isDefault && <MakeDefaultButton address={address} />}
        <form
          action={deleteAddressAction}
          onSubmit={(e) => {
            if (!window.confirm("Excluir este endereço?")) e.preventDefault();
          }}
          className="ml-auto"
        >
          <input type="hidden" name="addressId" value={address.id} />
          <SubmitButton
            pendingText="Excluindo…"
            className="inline-flex min-h-11 items-center text-sm text-red-600 underline-offset-4 hover:underline dark:text-red-400"
          >
            Excluir
          </SubmitButton>
        </form>
      </div>
    </article>
  );
}

/** Lista + formulário, com um único formulário aberto por vez. */
export function AddressesManager({
  addresses,
}: {
  addresses: CustomerAddress[];
}) {
  // "novo" | id do endereço em edição | null
  const [aberto, setAberto] = useState<string | null>(null);
  const vazio = addresses.length === 0;

  return (
    <div className="space-y-4">
      {vazio && aberto !== "novo" && (
        <div className="rounded-sm bg-surface px-6 py-10 text-center">
          <p className="font-display text-lg font-bold">
            Nenhum endereço salvo
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Salve onde você recebe as compras e o checkout já chega preenchido.
          </p>
          <button
            type="button"
            onClick={() => setAberto("novo")}
            className={`${primario} mt-5`}
          >
            Adicionar endereço
          </button>
        </div>
      )}

      {!vazio && (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) =>
            aberto === a.id ? (
              <div key={a.id} className="sm:col-span-2">
                <AddressForm
                  address={a}
                  onDone={() => setAberto(null)}
                  onCancel={() => setAberto(null)}
                />
              </div>
            ) : (
              <AddressCard
                key={a.id}
                address={a}
                onEdit={() => setAberto(a.id)}
              />
            ),
          )}
        </div>
      )}

      {aberto === "novo" ? (
        <AddressForm
          forceDefault={vazio}
          onDone={() => setAberto(null)}
          onCancel={() => setAberto(null)}
        />
      ) : (
        !vazio && (
          <button
            type="button"
            onClick={() => setAberto("novo")}
            className="flex h-12 w-full items-center justify-center rounded-sm border border-dashed border-border text-sm font-medium transition-colors hover:border-foreground sm:w-auto sm:px-6"
          >
            + Adicionar endereço
          </button>
        )
      )}
    </div>
  );
}
