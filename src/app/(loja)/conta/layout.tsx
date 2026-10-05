import type { ReactNode } from "react";
import { getCustomerProfile } from "@/lib/customer";
import { AccountShell } from "./account-shell";

/**
 * Layout de /conta/**: a casca com saudação e navegação.
 *
 * `getCustomerProfile` é o mesmo memoizado por requisição que as páginas usam
 * (não custa ida extra ao banco) e é quem GARANTE a linha em `customers` na
 * primeira visita — agora vale para qualquer página da conta, não só /conta.
 *
 * Sem sessão não há casca: a página logo abaixo chama `requireCustomer` e
 * manda para /entrar com o `next` certo.
 */
export default async function ContaLayout({ children }: { children: ReactNode }) {
  const profile = await getCustomerProfile();
  if (!profile) return children;

  return (
    <AccountShell
      firstName={profile.fullName?.trim().split(/\s+/)[0] || null}
      email={profile.email}
    >
      {children}
    </AccountShell>
  );
}
