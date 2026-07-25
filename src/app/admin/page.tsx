import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { getProducts } from "@/lib/products";
import { NewProductForm } from "./new-product-form";
import { signOutAction } from "./actions";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const products = await getProducts();
  const serviceRoleMissing = !process.env.SUPABASE_SERVICE_ROLE_KEY;

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Cadastro de produtos
          </h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
        </div>
        <form action={signOutAction}>
          <button className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
            Sair
          </button>
        </form>
      </header>

      {serviceRoleMissing && (
        <div className="mb-8 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Falta configurar <code>SUPABASE_SERVICE_ROLE_KEY</code> no servidor
          (.env.local / Vercel) para conseguir salvar produtos.
        </div>
      )}

      <div className="rounded-lg border border-border p-6">
        <NewProductForm />
      </div>

      <div className="mt-12">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-muted">
          Produtos cadastrados ({products.length})
        </h2>
        <ul className="divide-y divide-border">
          {products.map((p) => (
            <li
              key={p.slug}
              className="flex items-center justify-between py-3 text-sm"
            >
              <span>{p.name}</span>
              <Link
                href={`/produtos/${p.slug}`}
                className="text-muted underline-offset-4 hover:text-foreground hover:underline"
              >
                ver
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
