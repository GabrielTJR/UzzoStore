import type { ReactNode } from "react";
import type { CustomerProfile } from "@/lib/customer";
import { AccountHeading } from "../account-shell";
import { PasswordForm, ProfileForm } from "../account-forms";

/** Dados da conta: pessoais, e-mail (só leitura) e senha, em blocos separados
 * por linha — no celular, caixa em volta de caixa só rouba largura do campo. */
export function DataView({ profile }: { profile: CustomerProfile }) {
  return (
    <>
      <AccountHeading title="Dados" />
      <div className="max-w-2xl divide-y divide-border">
        <Secao titulo="Dados pessoais">
          <ProfileForm profile={profile} />
        </Secao>
        <Secao titulo="E-mail">
          <p className="text-sm">{profile.email ?? "—"}</p>
          <p className="mt-1 text-sm text-muted">
            É por ele que você entra e recebe os avisos dos pedidos. Para
            trocar, fale com a loja.
          </p>
        </Secao>
        <Secao titulo="Senha">
          <PasswordForm />
        </Secao>
      </div>
    </>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="py-6 first:pt-0">
      <h2 className="mb-4 font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}
