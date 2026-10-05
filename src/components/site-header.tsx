"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { CartButton } from "@/components/cart-button";
import {
  IconChevronDown,
  IconClose,
  IconHeart,
  IconMenu,
  IconSearch,
  IconUser,
} from "@/components/icons";
import { DEPARTMENTS, type Department } from "@/lib/departments";
import { useModal } from "@/lib/use-modal";

export type NavCategory = { name: string; slug: string };

/** Ordem dos departamentos na barra e na gaveta. */
const DEPTS: Department[] = ["masculino", "feminino"];

/**
 * Categoria de um departamento em ENDEREÇO LIMPO (`/masculino/polos`). Nunca
 * `/produtos?categorias=…`: essa URL é faceta e o Firewall da Vercel a desafia
 * ("Verificando seu navegador") — o menu caía nisso até out/2026.
 */
function categoriaHref(dep: Department, slug: string): string {
  return `/${dep}/${slug}`;
}

// Sem classe de display aqui: quem usa decide (`inline-flex` ou
// `hidden lg:inline-flex`). Com `inline-flex` na base, o `hidden` de quem
// some no celular perdia para ele na ordem do CSS e o ícone aparecia mesmo assim.
const iconBtn =
  "-m-2 items-center justify-center p-2 transition-opacity hover:opacity-60";

/**
 * Cabeçalho da loja: a barra do topo é SÓ navegação entre seções (Masculino,
 * Feminino, Ofertas) + busca, conta e sacola. Filtro não mora aqui — mora na
 * lateral do catálogo.
 *
 * Celular: menu à esquerda, logo no centro, busca e sacola à direita; o menu
 * abre uma gaveta com os departamentos e a conta. Desktop: logo à esquerda,
 * seções no centro (o Masculino abre um painel com as categorias) e os ícones
 * à direita.
 *
 * Sólido e `sticky` em todas as páginas. A versão anterior flutuava em vidro
 * sobre o banner da home; o hero novo começa abaixo do cabeçalho, então não há
 * arte por baixo para deixar transparecer.
 *
 * Cada departamento lista SÓ as categorias com peça ativa nele (unissex conta
 * nos dois — `getCategoryCovers`). O Feminino sem peça fica como link simples
 * com "em breve"; com a 1ª peça cadastrada ganha o mesmo painel/gaveta do
 * Masculino, sem mexer aqui. Os links de categoria seguem com
 * `prefetch={false}`: são muitos, e prefetch de todos no hover do painel seria
 * trabalho por visita sem clique.
 */
export function SiteHeader({
  isLogged,
  isAdmin,
  categories,
  femininoEmBreve,
  whatsappUrl,
}: {
  isLogged: boolean;
  isAdmin: boolean;
  /** Categorias com peça ativa em cada departamento (vazio = sem painel). */
  categories: Record<Department, NavCategory[]>;
  /** Feminino ainda sem produto: aparece no menu com a marca "em breve". */
  femininoEmBreve: boolean;
  whatsappUrl: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Na gaveta, o Masculino já vem aberto (é onde está quase tudo); o Feminino
  // abre no toque, para a lista dele não empurrar Ofertas e a conta para baixo.
  const [deptOpen, setDeptOpen] = useState<Record<Department, boolean>>({
    masculino: true,
    feminino: false,
  });
  const closeMenu = () => setMenuOpen(false);
  const menuRef = useModal<HTMLElement>(menuOpen, closeMenu);

  const contaHref = isLogged ? "/conta" : "/entrar";
  const contaLabel = isLogged ? "Minha conta" : "Entrar";

  const navLink =
    "relative flex h-full items-center text-sm font-medium after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:bg-foreground after:transition-transform hover:after:scale-x-100";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="px-page relative grid h-[var(--header-h)] grid-cols-[1fr_auto_1fr] items-center lg:grid-cols-[auto_1fr_auto] lg:gap-10">
        {/* Celular: abre o menu */}
        <div className="flex lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            className={`${iconBtn} inline-flex`}
          >
            <IconMenu />
          </button>
        </div>

        <Link href="/" aria-label="Uzzo Store — início" className="flex">
          <Logo height={27} className="h-[26px] lg:h-[30px]" />
        </Link>

        {/* Desktop: seções */}
        <nav
          aria-label="Seções da loja"
          className="hidden h-full items-center gap-8 lg:flex"
        >
          {DEPTS.map((dep) =>
            categories[dep].length > 0 ? (
              <div key={dep} className="group/mega flex h-full items-center">
                <Link href={`/${dep}`} className={navLink}>
                  {DEPARTMENTS[dep]}
                </Link>
                {/* Painel de categorias: abre no hover E no foco de teclado.
                    Ancora no cabeçalho (o item é `static`), então ocupa a
                    largura toda. Um por departamento, cada um com as SUAS
                    categorias — o Feminino ganha o dele com a 1ª peça. */}
                <div className="invisible absolute inset-x-0 top-full border-b border-border bg-background opacity-0 transition-opacity duration-150 group-focus-within/mega:visible group-focus-within/mega:opacity-100 group-hover/mega:visible group-hover/mega:opacity-100">
                  <div className="px-page grid grid-cols-[14rem_1fr] gap-10 py-8">
                    <div>
                      <p className="font-display text-xl font-bold">
                        {DEPARTMENTS[dep]}
                      </p>
                      <Link
                        href={`/${dep}`}
                        className="mt-3 inline-block text-sm underline underline-offset-4"
                      >
                        Ver tudo
                      </Link>
                    </div>
                    <ul className="grid grid-cols-3 gap-x-8 gap-y-3 xl:grid-cols-5">
                      {categories[dep].map((c) => (
                        <li key={c.slug}>
                          <Link
                            href={categoriaHref(dep, c.slug)}
                            prefetch={false}
                            className="text-sm text-muted transition-colors hover:text-foreground"
                          >
                            {c.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              // Sem categoria para listar (Feminino vazio, ou leitura que
              // falhou): link simples, sem painel vazio pendurado.
              <Link key={dep} href={`/${dep}`} className={navLink}>
                {DEPARTMENTS[dep]}
                {dep === "feminino" && femininoEmBreve && (
                  <span className="ml-2 rounded-xs bg-surface px-1.5 py-0.5 text-[0.7rem] font-medium text-muted">
                    em breve
                  </span>
                )}
              </Link>
            ),
          )}
          <Link href="/ofertas" className={navLink}>
            Ofertas
          </Link>
        </nav>

        <div className="flex items-center justify-end gap-5">
          {/* Desktop: busca sempre à mão. Formulário GET nativo — funciona sem
              JS e cai direto em /produtos?busca=. */}
          <form
            action="/produtos"
            role="search"
            className="relative hidden lg:block"
          >
            <input
              type="search"
              name="busca"
              placeholder="Buscar peça"
              aria-label="Buscar produtos"
              className="h-10 w-52 rounded-xs border border-border bg-transparent pl-3 pr-9 text-sm outline-none transition-[width,border-color] placeholder:text-muted focus:w-72 focus:border-foreground"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="absolute right-0 top-0 flex h-10 w-9 items-center justify-center text-muted hover:text-foreground"
            >
              <IconSearch size={18} />
            </button>
          </form>
          <button
            type="button"
            onClick={() => setSearchOpen((o) => !o)}
            aria-label="Buscar produtos"
            aria-expanded={searchOpen}
            className={`${iconBtn} inline-flex lg:hidden`}
          >
            <IconSearch />
          </button>
          <Link
            href={contaHref}
            aria-label={contaLabel}
            className={`${iconBtn} hidden lg:inline-flex`}
          >
            <IconUser />
          </Link>
          <Link
            href="/conta/favoritos"
            aria-label="Favoritos"
            className={`${iconBtn} hidden lg:inline-flex`}
          >
            <IconHeart />
          </Link>
          <CartButton />
          {isAdmin && (
            <Link
              href="/admin"
              className="hidden rounded-xs border border-foreground px-3 py-1.5 text-xs font-semibold lg:inline-block"
            >
              Painel
            </Link>
          )}
        </div>
      </div>

      {/* Celular: campo de busca que desce sob o cabeçalho */}
      {searchOpen && (
        <form
          action="/produtos"
          role="search"
          className="px-page border-t border-border py-3 lg:hidden"
        >
          <div className="relative">
            <input
              type="search"
              name="busca"
              autoFocus
              placeholder="O que você procura?"
              aria-label="Buscar produtos"
              className="h-12 w-full rounded-xs border border-foreground bg-transparent pl-4 pr-12 text-base outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center"
            >
              <IconSearch size={20} />
            </button>
          </div>
        </form>
      )}

      {/* Celular: gaveta do menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={closeMenu}
            className="absolute inset-0 animate-fade-in bg-black/50"
          />
          <aside
            ref={menuRef}
            tabIndex={-1}
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm animate-drawer-in-left flex-col bg-background outline-none"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
              <Logo height={22} />
              <button
                type="button"
                onClick={closeMenu}
                aria-label="Fechar menu"
                className={`${iconBtn} inline-flex`}
              >
                <IconClose />
              </button>
            </div>

            <nav
              aria-label="Seções da loja"
              className="flex-1 overflow-y-auto px-4 py-2"
            >
              {DEPTS.map((dep) =>
                categories[dep].length > 0 ? (
                  <div key={dep} className="border-b border-border">
                    <div className="flex items-center">
                      <Link
                        href={`/${dep}`}
                        onClick={closeMenu}
                        className="font-display flex-1 py-4 text-xl font-bold"
                      >
                        {DEPARTMENTS[dep]}
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          setDeptOpen((o) => ({ ...o, [dep]: !o[dep] }))
                        }
                        aria-expanded={deptOpen[dep]}
                        aria-label={`Categorias do ${DEPARTMENTS[dep].toLowerCase()}`}
                        className="-mr-2 p-3"
                      >
                        <IconChevronDown
                          size={20}
                          className={`transition-transform ${deptOpen[dep] ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>
                    {deptOpen[dep] && (
                      <ul className="grid grid-cols-2 gap-x-4 pb-4">
                        {categories[dep].map((c) => (
                          <li key={c.slug}>
                            <Link
                              href={categoriaHref(dep, c.slug)}
                              prefetch={false}
                              onClick={closeMenu}
                              className="block py-2 text-[0.95rem] text-muted"
                            >
                              {c.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <Link
                    key={dep}
                    href={`/${dep}`}
                    onClick={closeMenu}
                    className="font-display flex items-center border-b border-border py-4 text-xl font-bold"
                  >
                    {DEPARTMENTS[dep]}
                    {dep === "feminino" && femininoEmBreve && (
                      <span className="ml-3 rounded-xs bg-surface px-2 py-1 font-sans text-xs font-medium tracking-normal text-muted [font-stretch:100%]">
                        em breve
                      </span>
                    )}
                  </Link>
                ),
              )}
              <Link
                href="/ofertas"
                onClick={closeMenu}
                className="font-display block border-b border-border py-4 text-xl font-bold"
              >
                Ofertas
              </Link>

              <ul className="py-4 text-[0.95rem]">
                <li>
                  <Link
                    href={contaHref}
                    onClick={closeMenu}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <IconUser size={20} />
                    {contaLabel}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/conta/favoritos"
                    onClick={closeMenu}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <IconHeart size={20} />
                    Favoritos
                  </Link>
                </li>
                {isLogged && (
                  <li>
                    <Link
                      href="/conta/pedidos"
                      onClick={closeMenu}
                      className="block py-2.5 pl-8"
                    >
                      Meus pedidos
                    </Link>
                  </li>
                )}
                {isAdmin && (
                  <li>
                    <Link
                      href="/admin"
                      onClick={closeMenu}
                      className="block py-2.5 pl-8 font-semibold"
                    >
                      Painel da loja
                    </Link>
                  </li>
                )}
              </ul>
            </nav>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="m-4 flex h-12 shrink-0 items-center justify-center rounded-xs border border-foreground text-sm font-semibold"
            >
              Falar no WhatsApp
            </a>
          </aside>
        </div>
      )}
    </header>
  );
}
