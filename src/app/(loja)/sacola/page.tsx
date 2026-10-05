import { shippingConfigured } from "@/lib/shipping";
import { SacolaClient } from "./sacola-client";

/**
 * Wrapper de servidor: informa ao client se a cotação de frete existe.
 * Sem MELHORENVIO_TOKEN a sacola não PROMETE frete grátis nem mostra o
 * widget de CEP — prometer desconto que o servidor não aplica é pior do
 * que não prometer.
 */
export default function SacolaPage() {
  return <SacolaClient shippingEnabled={shippingConfigured()} />;
}
