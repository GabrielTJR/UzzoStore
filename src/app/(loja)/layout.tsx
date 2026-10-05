import { AnnouncementBar } from "@/components/announcement-bar";
import { CartDrawer } from "@/components/cart-drawer";
import { CookieConsent } from "@/components/cookie-consent";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WhatsappFab } from "@/components/whatsapp-fab";
import { getAdminUser } from "@/lib/admin";
import { categorySlug } from "@/lib/categories";
import { getCategories, hasDepartmentProducts } from "@/lib/products";
import { getSessionUser } from "@/lib/session";
import { shippingConfigured } from "@/lib/shipping";
import { WHATSAPP_URL } from "@/lib/store-info";

/**
 * Google Analytics 4 — ID de medição da conta da loja.
 *
 * Fica no código, e não numa env, de propósito: ele **não é segredo** (viaja no
 * HTML de toda página, é assim que funciona), é estável, e env que ninguém
 * lembra de cadastrar na Vercel já custou caro aqui — o checkout ficou 5 dias
 * fora por causa de uma (`INFINITEPAY` no lugar de `INFINITEPAY_HANDLE`), e a
 * `NEXT_PUBLIC_SITE_URL` vazia derrubou um build inteiro. Uma constante ao lado
 * das outras do arquivo não tem esse modo de falhar.
 *
 * Quem carrega o gtag.js é o `CookieConsent`, não este arquivo: sem aceite, o
 * script do Google nem entra na página.
 *
 * ⚠️ Ao trocar de conta do Google, este ID e o `GA_PROPERTY_ID` (env, usado
 * pelos cards de audiência do painel) precisam apontar para a MESMA
 * propriedade — senão o site mede numa conta e o painel lê de outra.
 */
const GA_MEASUREMENT_ID = "G-8RY0N74PG7";

/**
 * Casca da LOJA: faixa de avisos, cabeçalho, sacola, rodapé e cookies.
 * O painel (/admin) não passa por aqui.
 */
export default async function LojaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [adminUser, sessionUser, categories, temFeminino] = await Promise.all([
    getAdminUser(),
    getSessionUser(),
    getCategories(),
    hasDepartmentProducts("feminino"),
  ]);
  const freteAtivo = shippingConfigured();

  return (
    <>
      <AnnouncementBar freteAtivo={freteAtivo} />
      <SiteHeader
        isLogged={!!sessionUser} // cliente OU admin
        isAdmin={!!adminUser}
        categories={categories.map((c) => ({
          name: c.name,
          slug: categorySlug(c.name),
        }))}
        femininoEmBreve={!temFeminino}
        whatsappUrl={WHATSAPP_URL}
      />

      <main className="flex-1">{children}</main>

      {/* Gaveta da sacola (client, zustand) + WhatsApp flutuante. Montados
          no layout para funcionarem em qualquer página da vitrine. */}
      <CartDrawer shippingEnabled={freteAtivo} />
      <WhatsappFab />

      <SiteFooter />

      {/* Medição do site vive AQUI DENTRO, e só aqui: é o `CookieConsent`
          que carrega o Google Analytics, e só depois do "Aceitar". Não mova
          o gtag.js para fora deste componente — solto no layout ele passa a
          rodar antes de o cliente escolher, e o aviso de cookies vira
          fachada. */}
      <CookieConsent gaId={GA_MEASUREMENT_ID} />
    </>
  );
}
