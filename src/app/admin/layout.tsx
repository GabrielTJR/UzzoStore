import type { Metadata } from "next";
import { getAdminRecord } from "@/lib/admin";
import { countNewOrders } from "@/lib/admin-orders";
import { AdminShell } from "./admin-shell";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s | Painel Uzzo" },
  robots: { index: false, follow: false },
};

/**
 * Casca do painel — só para quem JÁ entrou.
 *
 * Login (`/admin/login`) e troca obrigatória de senha (`/admin/definir-senha`)
 * moram sob o mesmo `/admin`, mas não podem ganhar o menu: no login não há
 * admin, e no primeiro acesso o menu seria um convite a pular a troca. Por isso
 * a decisão é pelo ESTADO da sessão (não pelo endereço, que o layout nem
 * recebe): sem admin, ou com troca de senha pendente, a página sai sozinha.
 *
 * Isto é só apresentação. Quem protege cada tela continua sendo o
 * `requireAdmin()` da própria página, e cada server action revalida a
 * autorização — o layout não é barreira de segurança.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const res = await getAdminRecord();

  if (!res || res.record.must_change_password) {
    return <main className="flex-1">{children}</main>;
  }

  // Sem a service_role a contagem lançaria; o painel avisa disso na Visão
  // geral, e o menu segue funcionando sem o contador.
  const novos = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? await countNewOrders().catch(() => 0)
    : 0;

  return (
    <AdminShell
      email={res.user.email ?? null}
      nome={res.record.full_name}
      novosPedidos={novos}
    >
      {children}
    </AdminShell>
  );
}
