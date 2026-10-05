import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getAdminOverview } from "@/lib/admin-overview";
import { getAudience } from "@/lib/analytics";
import { OverviewView } from "./overview-view";

export const metadata: Metadata = { title: "Visão geral" };

/** Tela de abertura do painel. O desenho fica em `overview-view.tsx`. */
export default async function AdminOverviewPage() {
  await requireAdmin();
  const serviceRoleMissing = !process.env.SUPABASE_SERVICE_ROLE_KEY;

  const [overview, audience] = await Promise.all([
    serviceRoleMissing ? null : getAdminOverview(),
    getAudience(),
  ]);

  return (
    <OverviewView
      overview={overview}
      audience={audience}
      serviceRoleMissing={serviceRoleMissing}
    />
  );
}
