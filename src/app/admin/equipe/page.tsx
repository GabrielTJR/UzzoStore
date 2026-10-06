import type { Metadata } from "next";
import { getAdminRecord, requireArea } from "@/lib/admin";
import { CARGOS, CARGOS_ATRIBUIVEIS, type AdminRole } from "@/lib/admin-roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Panel } from "../admin-ui";
import { AddAdminForm } from "./add-admin-form";
import { RemoveAdminButton } from "./remove-admin-button";
import { RoleSelect, TempPasswordForm } from "./member-forms";

export const metadata: Metadata = { title: "Equipe" };

type Row = {
  user_id: string;
  full_name: string | null;
  role: AdminRole;
  must_change_password: boolean;
  email: string | null;
  lastSignIn: string | null;
};

/**
 * Equipe + e-mail e último acesso de cada um. O último acesso vem do PRÓPRIO
 * Supabase Auth (`last_sign_in_at`), na mesma chamada que já trazia o e-mail —
 * nenhuma leitura a mais do registro de atividades.
 */
async function getAdmins(): Promise<Row[]> {
  const admin = createAdminClient();
  const [{ data: rows }, { data: usersData }] = await Promise.all([
    admin
      .from("admins")
      .select("user_id, full_name, role, must_change_password, created_at")
      .order("created_at"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const byId = new Map((usersData?.users ?? []).map((u) => [u.id, u]));
  return (rows ?? []).map((r) => {
    const u = byId.get(r.user_id);
    return {
      user_id: r.user_id,
      full_name: r.full_name,
      role: r.role as AdminRole,
      must_change_password: r.must_change_password,
      email: u?.email ?? null,
      lastSignIn: u?.last_sign_in_at ?? null,
    };
  });
}

const ORDEM: Record<AdminRole, number> = { owner: 0, admin: 1, vendedor: 2 };

const quando = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const hora = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** Dia do calendário em São Paulo, em número (para "hoje"/"ontem" certos). */
const diaSP = (d: Date) =>
  Math.floor(
    Date.parse(
      d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    ) / 86_400_000,
  );

function ultimoAcesso(iso: string | null): string {
  if (!iso) return "Nunca entrou";
  const d = new Date(iso);
  const dias = diaSP(new Date()) - diaSP(d);
  if (dias <= 0) return `Hoje às ${hora.format(d)}`;
  if (dias === 1) return `Ontem às ${hora.format(d)}`;
  if (dias < 30) return `Há ${dias} dias`;
  return quando.format(d);
}

export default async function EquipePage() {
  await requireArea("equipe");
  const rec = (await getAdminRecord())!;
  const isOwner = rec.record.role === "owner";
  const serviceRoleMissing = !process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admins = serviceRoleMissing
    ? []
    : (await getAdmins()).sort(
        (a, b) =>
          ORDEM[a.role] - ORDEM[b.role] ||
          (a.full_name ?? a.email ?? "").localeCompare(
            b.full_name ?? b.email ?? "",
          ),
      );

  return (
    <>
      <PageHeader
        title="Equipe"
        description={
          isOwner
            ? "Quem tem acesso ao painel e o que cada um pode fazer. Só você, como dono, adiciona, remove e muda cargos."
            : "Quem tem acesso ao painel. Só o dono adiciona, remove e muda cargos."
        }
      />

      {serviceRoleMissing && (
        <div className="mb-6 rounded-xs border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Falta configurar <code>SUPABASE_SERVICE_ROLE_KEY</code> no servidor.
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Panel>
          <ul className="divide-y divide-border">
            {admins.map((a) => {
              const voce = a.user_id === rec.user.id;
              const editavel = isOwner && !voce && a.role !== "owner";
              return (
                <li
                  key={a.user_id}
                  className="relative grid gap-x-6 gap-y-3 p-4 sm:grid-cols-[minmax(0,1fr)_11rem_10.5rem] sm:items-center lg:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {a.full_name ?? a.email ?? "Sem nome"}
                      {voce && (
                        <span className="ml-2 text-xs font-normal text-muted">
                          (você)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {a.full_name ? a.email : null}
                    </p>
                    {a.must_change_password ? (
                      <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                        Primeiro acesso pendente — ainda não trocou a senha
                        provisória
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted">
                        Último acesso: {ultimoAcesso(a.lastSignIn)}
                      </p>
                    )}
                  </div>

                  <div>
                    {editavel ? (
                      <RoleSelect userId={a.user_id} role={a.role} />
                    ) : (
                      <span className="text-sm font-medium">
                        {CARGOS[a.role].nome}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 sm:justify-end">
                    {editavel && (
                      <>
                        <TempPasswordForm
                          userId={a.user_id}
                          nome={a.full_name ?? a.email ?? "esta pessoa"}
                        />
                        <RemoveAdminButton userId={a.user_id} />
                      </>
                    )}
                  </div>
                </li>
              );
            })}
            {admins.length === 0 && !serviceRoleMissing && (
              <li className="p-8 text-center text-sm text-muted">
                Ninguém na equipe ainda.
              </li>
            )}
          </ul>
        </Panel>

        <div className="space-y-6">
          {isOwner && (
            <Panel className="p-5">
              <h2 className="mb-4 font-semibold">Adicionar pessoa</h2>
              <AddAdminForm />
            </Panel>
          )}
          <Panel className="p-5">
            <h2 className="mb-3 font-semibold">O que cada cargo faz</h2>
            <dl className="space-y-3 text-sm">
              {(["owner", ...CARGOS_ATRIBUIVEIS] as AdminRole[]).map((r) => (
                <div key={r}>
                  <dt className="font-medium">{CARGOS[r].nome}</dt>
                  <dd className="text-muted">{CARGOS[r].descricao}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
