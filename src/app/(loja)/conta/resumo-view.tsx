import Link from "next/link";
import type { ComponentType } from "react";
import { perfilCompleto } from "@/lib/customer-fields";
import type { CustomerAddress, CustomerProfile } from "@/lib/customer";
import {
  IconChevronRight,
  IconHeart,
  IconHome,
  IconUser,
} from "@/components/icons";
import type { AccountOrder } from "./order-data";
import { EmptyState, OrderCard } from "./pedidos/order-ui";
import { emAndamento } from "./pedidos/orders-view";

/**
 * Início da conta. O que o cliente procura aqui é UM pedido — o que ainda não
 * chegou —, então ele vem primeiro, com o "Pagar agora" à mão. Embaixo, o
 * estado das outras seções numa linha cada ("2 endereços", "falta o CPF"),
 * para ninguém ter de abrir a aba para descobrir se precisa abrir a aba.
 *
 * Antes /conta era o formulário de CPF: quem tocava em "Minha conta" para ver
 * o pedido caía nos dados cadastrais.
 */
export function ResumoView({
  profile,
  orders,
  addresses,
  favoritos,
}: {
  profile: CustomerProfile;
  /** Os mais recentes (poucos): o resumo não é a lista. */
  orders: AccountOrder[];
  addresses: CustomerAddress[];
  favoritos: number;
}) {
  const abertos = orders.filter(emAndamento).slice(0, 2);
  const destaque = abertos.length ? abertos : orders.slice(0, 1);
  const principal = addresses.find((a) => a.isDefault) ?? addresses[0];
  const completo = perfilCompleto(profile);

  return (
    <>
      {/* A saudação da casca já abre a página; repetir "Resumo" em letra
          grande empurraria o pedido para baixo da dobra no celular. */}
      <h1 className="sr-only">Resumo da conta</h1>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold">
            {abertos.length ? "Em andamento" : "Último pedido"}
          </h2>
          {orders.length > 0 && (
            <Link
              href="/conta/pedidos"
              className="inline-flex min-h-11 items-center text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              Ver todos
            </Link>
          )}
        </div>
        {destaque.length ? (
          <div className="space-y-3">
            {destaque.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhum pedido ainda"
            text="Quando você comprar pelo site, acompanha tudo por aqui."
          />
        )}
      </section>

      <ul className="mt-10 divide-y divide-border border-y border-border">
        <Atalho
          href="/conta/dados"
          Icon={IconUser}
          titulo="Dados"
          linha={
            completo
              ? "Nome, CPF e celular completos"
              : "Complete CPF e celular para pagar mais rápido"
          }
          alerta={!completo}
        />
        <Atalho
          href="/conta/enderecos"
          Icon={IconHome}
          titulo="Endereços"
          linha={
            principal
              ? [principal.street, principal.number]
                  .filter(Boolean)
                  .join(", ") +
                (addresses.length > 1 ? ` e mais ${addresses.length - 1}` : "")
              : "Nenhum endereço salvo"
          }
        />
        <Atalho
          href="/conta/favoritos"
          Icon={IconHeart}
          titulo="Favoritos"
          linha={
            favoritos
              ? `${favoritos} ${favoritos === 1 ? "peça salva" : "peças salvas"}`
              : "Nenhuma peça salva"
          }
        />
      </ul>
    </>
  );
}

function Atalho({
  href,
  Icon,
  titulo,
  linha,
  alerta = false,
}: {
  href: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  titulo: string;
  linha: string;
  alerta?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-16 items-center gap-4 py-3 transition-colors hover:bg-surface/60"
      >
        <Icon size={22} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{titulo}</span>
          <span
            className={`block truncate text-sm ${alerta ? "font-medium text-accent" : "text-muted"}`}
          >
            {linha}
          </span>
        </span>
        <IconChevronRight size={18} className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}
