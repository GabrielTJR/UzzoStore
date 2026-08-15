import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminRecord } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { AddAdminForm } from "./add-admin-form";
import { RemoveAdminButton } from "./remove-admin-button";

export const metadata: Metadata = { title: "Equipe" };

type Row = {
  user_id: string;
  full_name: string | null;
  role: string;
  must_change_password: boolean;
  email: string | null;
};

async function getAdmins(): Promise<Row[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("admins")
    .select("user_id, full_name, role, must_change_password, created_at")
    .order("created_at");
  const { data: usersData } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const emailById = new Map(
    (usersData?.users ?? []).map((u) => [u.id, u.email ?? null]),
  );
  return (rows ?? []).map((r) => ({
    user_id: r.user_id,
    full_name: r.full_name,
    role: r.role,
    must_change_password: r.must_change_password,
    email: emailById.get(r.user_id) ?? null,
  }));
}

export default async function EquipePage() {
  const rec = await getAdminRecord();
  if (!rec) redirect("/admin/login");
  if (rec.record.must_change_password) redirect("/admin/definir-senha");
  const isOwner = rec.record.role === "owner";
  const serviceRoleMissing = !process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admins = serviceRoleMissing ? [] : await getAdmins();

  return (
    <section className="mx-auto max-w-3xl space-y-10 px-6 py-12">
      <header>
        <Link
          href="/admin"
          className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Produtos
        </Link>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">
          Equipe
        </h1>
        <p className="mt-1 text-sm text-muted">Admins com acesso ao painel.</p>
      </header>

      {serviceRoleMissing && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Falta configurar <code>SUPABASE_SERVICE_ROLE_KEY</code> no servidor.
        </div>
      )}

      {isOwner && (
        <div className="rounded-lg border border-border p-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-muted">
            Adicionar admin
          </h2>
          <AddAdminForm />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Papel</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {isOwner && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {admins.map((a) => (
              <tr key={a.user_id}>
                <td className="px-4 py-3">
                  {a.full_name ?? "—"}
                  {a.user_id === rec.user.id && (
                    <span className="ml-2 text-xs text-muted">(você)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{a.email ?? "—"}</td>
                <td className="px-4 py-3">
                  {a.role === "owner" ? "Owner" : "Admin"}
                </td>
                <td className="px-4 py-3 text-muted">
                  {a.must_change_password ? "1º acesso pendente" : "Ativo"}
                </td>
                {isOwner && (
                  <td className="px-4 py-3 text-right">
                    {a.user_id !== rec.user.id && a.role !== "owner" && (
                      <RemoveAdminButton userId={a.user_id} />
                    )}
                  </td>
                )}
              </tr>
            ))}
            {admins.length === 0 && !serviceRoleMissing && (
              <tr>
                <td
                  colSpan={isOwner ? 5 : 4}
                  className="px-4 py-8 text-center text-muted"
                >
                  Nenhum admin cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
