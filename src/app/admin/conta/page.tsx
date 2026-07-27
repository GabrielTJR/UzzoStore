import Link from "next/link";
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
    <section className="mx-auto max-w-lg space-y-10 px-6 py-12">
      <header>
        <Link
          href="/admin"
          className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Produtos
        </Link>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">
          Minha conta
        </h1>
        <p className="mt-1 text-sm text-muted">
          {rec.user.email}
          {rec.record.role === "owner" && " · Owner"}
        </p>
      </header>

      <div className="rounded-lg border border-border p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-muted">
          Nome
        </h2>
        <NameForm currentName={rec.record.full_name} />
      </div>

      <div className="rounded-lg border border-border p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-muted">
          Senha
        </h2>
        <PasswordForm />
      </div>
    </section>
  );
}
