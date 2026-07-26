import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { getAuditLog, getAuditActions } from "@/lib/audit-queries";

export const metadata: Metadata = { title: "Logs" };

const ACTION_LABELS: Record<string, string> = {
  "product.create": "Produto criado",
  "product.update": "Produto editado",
  "product.delete": "Produto excluído",
  "variant.save": "Variante salva",
  "variant.delete": "Variante excluída",
  "photo.add": "Foto adicionada",
  "photo.remove": "Foto removida",
  "auth.login": "Login",
  "admin.invite": "Admin convidado",
  "admin.remove": "Admin removido",
  "admin.password_reset": "Senha redefinida",
};

function actionLabel(a: string): string {
  return ACTION_LABELS[a] ?? a;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  });
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted hover:border-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  if (!(await getAdminUser())) redirect("/admin/login");
  const { action } = await searchParams;

  const [rows, actions] = await Promise.all([
    getAuditLog({ action, limit: 200 }),
    getAuditActions(),
  ]);

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <Link
          href="/admin"
          className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Produtos
        </Link>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">
          Logs de auditoria
        </h1>
        <p className="mt-1 text-sm text-muted">
          Registro de quem fez o quê no painel.
        </p>
      </header>

      {actions.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <FilterChip href="/admin/logs" active={!action}>
            Todas
          </FilterChip>
          {actions.map((a) => (
            <FilterChip
              key={a}
              href={`/admin/logs?action=${encodeURIComponent(a)}`}
              active={action === a}
            >
              {actionLabel(a)}
            </FilterChip>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Quando</th>
              <th className="px-4 py-3 font-medium">Quem</th>
              <th className="px-4 py-3 font-medium">Ação</th>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-3 text-muted">
                  {fmtDate(r.created_at)}
                </td>
                <td className="px-4 py-3">{r.actor_email ?? "sistema"}</td>
                <td className="px-4 py-3">{actionLabel(r.action)}</td>
                <td className="px-4 py-3 text-muted">
                  {r.entity_type === "product" && r.entity_id ? (
                    <Link
                      href={`/admin/produtos/${r.entity_id}`}
                      className="underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {r.entity_label ?? r.entity_id.slice(0, 8)}
                    </Link>
                  ) : (
                    (r.entity_label ?? "—")
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{r.ip ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  Nenhum registro ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
