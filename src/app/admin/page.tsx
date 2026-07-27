import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getAdminProducts } from "@/lib/admin-products";
import { formatBRL } from "@/lib/format";
import { signOutAction } from "./actions";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await requireAdmin();

  const products = await getAdminProducts();
  const serviceRoleMissing = !process.env.SUPABASE_SERVICE_ROLE_KEY;

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Produtos
          </h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/logs"
            className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            Logs
          </Link>
          <Link
            href="/admin/equipe"
            className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            Equipe
          </Link>
          <Link
            href="/admin/conta"
            className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            Conta
          </Link>
          <form action={signOutAction}>
            <button className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
              Sair
            </button>
          </form>
        </div>
      </header>

      {serviceRoleMissing && (
        <div className="mb-8 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Falta configurar <code>SUPABASE_SERVICE_ROLE_KEY</code> no servidor
          (.env.local / Vercel) para salvar alterações.
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm text-muted">
          {products.length} {products.length === 1 ? "produto" : "produtos"}
        </span>
        <Link
          href="/admin/produtos/novo"
          className="inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          + Novo produto
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Produto</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Preço</th>
              <th className="px-4 py-3 font-medium">Fotos</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium">
                  {p.name}
                  {p.featured && (
                    <span className="ml-2 text-xs text-muted">★</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{p.category ?? "—"}</td>
                <td className="px-4 py-3">
                  {p.price != null ? formatBRL(p.price) : "—"}
                </td>
                <td className="px-4 py-3 text-muted">{p.images}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      p.active
                        ? "text-green-600 dark:text-green-400"
                        : "text-muted"
                    }
                  >
                    {p.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/produtos/${p.id}`}
                    className="text-muted underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Nenhum produto ainda. Clique em “Novo produto”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
