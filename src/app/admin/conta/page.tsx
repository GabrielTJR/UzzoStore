import type { Metadata } from "next";
import { getAdminRecord, requireAdmin } from "@/lib/admin";
import { CARGOS } from "@/lib/admin-roles";
import { PageHeader, Panel } from "../admin-ui";
import { NameForm, PasswordForm } from "./account-forms";

export const metadata: Metadata = { title: "Minha conta" };

export default async function ContaPage() {
  await requireAdmin();
  const rec = (await getAdminRecord())!;
  const cargo = CARGOS[rec.record.role];
  const semNome = !rec.record.full_name?.trim();

  return (
    <>
      <PageHeader title="Minha conta" description={rec.user.email} />

      <div className="grid max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Panel className="divide-y divide-border">
          <section className="p-5 lg:p-6">
            <h2 className="font-semibold">Seu nome</h2>
            <p
              className={`mb-4 mt-1 text-sm ${semNome ? "text-amber-700 dark:text-amber-400" : "text-muted"}`}
            >
              {semNome
                ? "Ainda sem nome: o registro de atividades e a equipe mostram o começo do seu e-mail no lugar."
                : "Aparece no registro de atividades e na lista da equipe."}
            </p>
            <NameForm currentName={rec.record.full_name} />
          </section>
          <section className="p-5 lg:p-6">
            <h2 className="font-semibold">Senha</h2>
            <p className="mb-4 mt-1 text-sm text-muted">
              Para trocar, digite a nova duas vezes. Quem esquecer a senha pode
              pedir uma provisória ao dono, em Equipe.
            </p>
            <PasswordForm />
          </section>
        </Panel>

        <Panel className="p-5 text-sm">
          <h2 className="font-semibold">Seu acesso</h2>
          <p className="mt-2 font-medium">{cargo.nome}</p>
          <p className="text-muted">{cargo.descricao}</p>
        </Panel>
      </div>
    </>
  );
}
