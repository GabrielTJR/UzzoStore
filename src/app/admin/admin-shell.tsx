"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Logo } from "@/components/logo";
import {
  IconBox,
  IconClose,
  IconDrop,
  IconExternal,
  IconGrid,
  IconHome,
  IconLayout,
  IconList,
  IconLogout,
  IconMenu,
  IconRuler,
  IconShirt,
  IconTag,
  IconUser,
  IconUsers,
} from "@/components/icons";
import { useModal } from "@/lib/use-modal";
import {
  CARGOS,
  podeAcessar,
  type AdminArea,
  type AdminRole,
} from "@/lib/admin-roles";
import { signOutAction } from "./actions";

type Item = {
  href: string;
  label: string;
  icon: (p: { size?: number }) => React.ReactNode;
  /** Área do cargo (`lib/admin-roles.ts`): some do menu de quem não alcança. */
  area: AdminArea;
  /** Só casa o endereço exato (a Visão geral é /admin, prefixo de tudo). */
  exact?: boolean;
  /** Mostra o contador de pedidos novos. */
  pedidos?: boolean;
};

/**
 * O menu do painel, agrupado pelo que a loja FAZ, na ordem do dia a dia:
 * primeiro o que vende, depois o que cadastra, depois a vitrine e o sistema.
 */
const GRUPOS: { titulo: string | null; itens: Item[] }[] = [
  {
    titulo: null,
    itens: [
      {
        href: "/admin",
        label: "Visão geral",
        icon: IconHome,
        area: "visao-geral",
        exact: true,
      },
    ],
  },
  {
    titulo: "Vendas",
    itens: [
      {
        href: "/admin/pedidos",
        label: "Pedidos",
        icon: IconBox,
        area: "pedidos",
        pedidos: true,
      },
      { href: "/admin/cupons", label: "Cupons", icon: IconTag, area: "cupons" },
    ],
  },
  {
    titulo: "Catálogo",
    itens: [
      {
        href: "/admin/produtos",
        label: "Produtos",
        icon: IconShirt,
        area: "produtos",
      },
      {
        href: "/admin/categorias",
        label: "Categorias",
        icon: IconGrid,
        area: "categorias",
      },
      { href: "/admin/cores", label: "Cores", icon: IconDrop, area: "cores" },
      {
        href: "/admin/medidas",
        label: "Tabelas de medidas",
        icon: IconRuler,
        area: "medidas",
      },
    ],
  },
  {
    titulo: "Vitrine",
    itens: [
      {
        href: "/admin/decoracao",
        label: "Página inicial",
        icon: IconLayout,
        area: "pagina-inicial",
      },
    ],
  },
  {
    titulo: "Sistema",
    itens: [
      {
        href: "/admin/equipe",
        label: "Equipe",
        icon: IconUsers,
        area: "equipe",
      },
      {
        href: "/admin/logs",
        label: "Registro de atividades",
        icon: IconList,
        area: "logs",
      },
    ],
  },
];

const linha =
  "flex h-9 items-center gap-3 rounded-xs px-2.5 text-sm font-medium transition-colors";
const inativa = "text-white/65 hover:bg-white/10 hover:text-white";
const ativa = "bg-white/15 text-white";

/**
 * Casca do painel: menu lateral fixo + área de trabalho em largura inteira.
 *
 * O painel é ferramenta de DESKTOP (é onde a loja cadastra e despacha), então a
 * lateral fica sempre aberta e o conteúdo usa todo o resto da tela. No celular
 * a lateral vira gaveta, atrás de uma barra com o menu e o atalho de pedidos —
 * dá para conferir um pedido na rua, mas não é o caso de uso principal.
 *
 * Sempre preto, nos dois temas: separa o painel da loja à primeira vista.
 */
export function AdminShell({
  children,
  email,
  nome,
  role,
  novosPedidos,
}: {
  children: React.ReactNode;
  email: string | null;
  nome: string | null;
  role: AdminRole;
  novosPedidos: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const drawerRef = useModal<HTMLElement>(open, close);

  const isActive = (i: Item) =>
    i.exact ? pathname === i.href : pathname.startsWith(i.href);

  const menu = (
    <>
      <Link href="/admin" onClick={close} className="mb-5 flex px-2.5 pt-1">
        <Logo height={24} />
      </Link>

      <nav aria-label="Painel" className="flex-1 space-y-4 overflow-y-auto">
        {GRUPOS.map((g) => ({
          ...g,
          itens: g.itens.filter((i) => podeAcessar(role, i.area)),
        }))
          .filter((g) => g.itens.length > 0)
          .map((g) => (
            <div key={g.titulo ?? "inicio"}>
              {g.titulo && (
                <p className="mb-1 px-2.5 text-xs font-medium text-white/40">
                  {g.titulo}
                </p>
              )}
              <ul className="space-y-0.5">
                {g.itens.map((i) => {
                  const on = isActive(i);
                  return (
                    <li key={i.href}>
                      <Link
                        href={i.href}
                        onClick={close}
                        aria-current={on ? "page" : undefined}
                        className={`${linha} ${on ? ativa : inativa}`}
                      >
                        <i.icon size={18} />
                        {i.label}
                        {i.pedidos && novosPedidos > 0 && (
                          <span
                            aria-label={`${novosPedidos} novos`}
                            className="ml-auto rounded-full bg-white px-1.5 text-[0.7rem] font-bold leading-5 text-black"
                          >
                            {novosPedidos}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
      </nav>

      <div className="mt-4 space-y-0.5 border-t border-white/15 pt-3">
        <Link href="/" target="_blank" className={`${linha} ${inativa}`}>
          <IconExternal size={18} />
          Ver a loja
        </Link>
        <Link
          href="/admin/conta"
          onClick={close}
          aria-current={
            pathname.startsWith("/admin/conta") ? "page" : undefined
          }
          className={`${linha} ${pathname.startsWith("/admin/conta") ? ativa : inativa}`}
        >
          <IconUser size={18} />
          Minha conta
        </Link>
        <form action={signOutAction}>
          <button type="submit" className={`${linha} ${inativa} w-full`}>
            <IconLogout size={18} />
            Sair
          </button>
        </form>
        <div className="px-2.5 pt-2 text-xs text-white/40">
          {nome && <p className="truncate text-white/70">{nome}</p>}
          <p className="truncate">{email}</p>
          <p className="truncate">{CARGOS[role].nome}</p>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-surface lg:flex-row">
      {/* Celular: barra do topo */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between bg-black px-4 text-white lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu do painel"
          aria-expanded={open}
          className="-m-2 p-2"
        >
          <IconMenu />
        </button>
        <Link href="/admin" aria-label="Visão geral">
          <Logo height={22} />
        </Link>
        <Link
          href="/admin/pedidos"
          aria-label={
            novosPedidos > 0 ? `Pedidos (${novosPedidos} novos)` : "Pedidos"
          }
          className="relative -m-2 p-2"
        >
          <IconBox />
          {novosPedidos > 0 && (
            <span className="absolute right-0 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[0.6rem] font-bold text-black">
              {novosPedidos}
            </span>
          )}
        </Link>
      </header>

      {/* Desktop: lateral fixa */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-black p-3 text-white lg:flex">
        {menu}
      </aside>

      {/* Celular: a mesma lateral, como gaveta */}
      {open && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu do painel"
        >
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={close}
            className="absolute inset-0 animate-fade-in bg-black/60"
          />
          <aside
            ref={drawerRef}
            tabIndex={-1}
            className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs animate-drawer-in-left flex-col bg-black p-3 text-white outline-none"
          >
            <button
              type="button"
              onClick={close}
              aria-label="Fechar menu"
              className="absolute right-2 top-2 p-2 text-white/70"
            >
              <IconClose size={20} />
            </button>
            {menu}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {children}
      </div>
    </div>
  );
}
