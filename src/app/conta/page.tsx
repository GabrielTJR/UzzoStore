import Link from "next/link";
import type { Metadata } from "next";
import { requireCustomer, getCustomerProfile } from "@/lib/customer";
import { ProfileForm, PasswordForm, SignOutButton } from "./account-forms";

export const metadata: Metadata = { title: "Minha conta" };

const tab =
  "rounded-full border border-border px-4 py-1.5 text-sm text-muted transition-colors hover:border-foreground hover:text-foreground";

export default async function ContaPage() {
  await requireCustomer();
  const profile = await getCustomerProfile();
  if (!profile) return null;

  return (
    <section className="mx-auto max-w-3xl space-y-10 px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Minha conta
          </h1>
          <p className="mt-1 text-sm text-muted">
            Olá{profile.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}!
          </p>
        </div>
        <SignOutButton />
      </header>

      <nav className="flex flex-wrap gap-2">
        <span className="rounded-full border border-foreground bg-foreground px-4 py-1.5 text-sm font-medium text-background">
          Dados
        </span>
        <Link href="/conta/enderecos" className={tab}>
          Endereços
        </Link>
        <Link href="/conta/pedidos" className={tab}>
          Pedidos
        </Link>
        <Link href="/conta/favoritos" className={tab}>
          Favoritos
        </Link>
      </nav>

      <div>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-muted">
          Dados pessoais
        </h2>
        <ProfileForm profile={profile} />
      </div>

      <div>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-muted">
          Senha
        </h2>
        <PasswordForm />
      </div>
    </section>
  );
}
