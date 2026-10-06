"use client";

import { FRETE_GRATIS_MIN } from "@/lib/shipping-config";
import { formatBRL } from "@/lib/format";

/**
 * "Faltam R$ X para o frete grátis" com barra de progresso — o empurrão de
 * tíquete médio clássico. 100% client (o subtotal já está no Zustand); o
 * desconto REAL é aplicado no servidor pela mesma constante, então a barra
 * nunca promete o que o checkout não cumpre.
 *
 * O mínimo vale DEPOIS do cupom: quem tem o desconto passa o subtotal já
 * descontado (sacola). A gaveta não sabe o valor do desconto — com cupom ela
 * só avisa (`comCupom`), para não prometer frete grátis que o desconto tira.
 */
export function FreeShippingBar({
  subtotal,
  comCupom = false,
}: {
  subtotal: number;
  comCupom?: boolean;
}) {
  if (FRETE_GRATIS_MIN == null || subtotal <= 0) return null;
  const falta = FRETE_GRATIS_MIN - subtotal;
  const pct = Math.min(100, Math.round((subtotal / FRETE_GRATIS_MIN) * 100));

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted">
        {falta > 0 ? (
          <>
            Faltam{" "}
            <strong className="text-foreground">{formatBRL(falta)}</strong> para
            o <strong className="text-foreground">frete grátis</strong>
          </>
        ) : comCupom ? (
          <>
            Frete grátis quando o total{" "}
            <strong className="text-foreground">depois do cupom</strong> passar
            de {formatBRL(FRETE_GRATIS_MIN)}
          </>
        ) : (
          <strong className="text-foreground">Você ganhou frete grátis!</strong>
        )}
      </p>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso para o frete grátis"
        className="h-1.5 overflow-hidden rounded-full bg-border"
      >
        <div
          className="h-full rounded-full bg-foreground transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
