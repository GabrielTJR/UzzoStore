import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminRecord } from "@/lib/admin";
import { NameForm, PasswordForm } from "./account-forms";

export const metadata: Metadata = { title: "Minha conta" };

export default async function ContaPage() {
  const rec = await getAdminRecord();
  if (!rec) redirect("/admin/login");
  if (rec.record.must_change_password) redirect("/admin/definir-senha");

  return (
    <section className="max-w-lg space-y-10">
      <header>
        <h1 className="font-display text-2xl font-bold lg:text-3xl">
          Minha conta
        </h1>
        <p className="mt-1 text-sm text-muted">
          {rec.user.email}
          {rec.record.role === "owner" && " · Owner"}
        </p>
      </header>

      <div className="rounded-sm border border-border p-6">
        <h2 className="mb-4 text-sm font-medium text-muted">
          Nome
        </h2>
        <NameForm currentName={rec.record.full_name} />
      </div>

      <div className="rounded-sm border border-border p-6">
        <h2 className="mb-4 text-sm font-medium text-muted">
          Senha
        </h2>
        <PasswordForm />
      </div>
    </section>
  );
}
