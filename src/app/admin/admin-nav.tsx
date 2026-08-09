import Link from "next/link";
import { signOutAction } from "./actions";

/**
 * Menu do painel. Em chips que QUEBRAM em várias linhas: a lista cresceu
 * (Pedidos, Decoração, Categorias, Cores, Medidas, Logs, Equipe, Conta, Sair)
 * e, numa linha só, vazava a tela no celular e no desktop estreito.
 */
const item =
  "rounded-full border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-foreground hover:text-foreground";

const LINKS = [
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/decoracao", label: "Decoração" },
  { href: "/admin/categorias", label: "Categorias" },
  { href: "/admin/cores", label: "Cores" },
  { href: "/admin/medidas", label: "Medidas" },
  { href: "/admin/logs", label: "Logs" },
  { href: "/admin/equipe", label: "Equipe" },
  { href: "/admin/conta", label: "Conta" },
];

export function AdminNav() {
  return (
    <nav className="flex flex-wrap items-center gap-2 sm:justify-end">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={item}>
          {l.label}
        </Link>
      ))}
      <form action={signOutAction}>
        <button type="submit" className={item}>
          Sair
        </button>
      </form>
    </nav>
  );
}
