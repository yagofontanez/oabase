import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Source_Serif_4 } from "next/font/google";
import { JsonLd } from "@/lib/jsonld";
import { operador } from "@/lib/legal";
import { abs, site } from "@/lib/site";
import "./globals.css";

/* Plus Jakarta Sans carrega a interface e o display: geométrica e quente, com desenho suficiente nos pesos altos para segurar título sem precisar de uma segunda família gritando.

   Source Serif é reservada ao texto de lei e ao enunciado de questão.
   Quando a serifa aparece na página, é porque começou o Direito. */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: site.locale,
    url: site.url,
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  twitter: { card: "summary_large_image", site: site.twitter },
  formatDetection: { telephone: false },
  /*
    Verificação de propriedade nos buscadores.

    Vem do ambiente e não do código porque o token é da conta de quem opera o
    site, não do projeto — e porque um token errado no repositório é uma
    verificação que ninguém consegue explicar por que falhou.

    Sem Search Console, o site não tem como responder quais páginas foram
    indexadas nem quais consultas trazem gente. Num projeto cuja aquisição é
    100% orgânica, essa é a única medição que importa antes de qualquer outra.
    Ausente a variável, o campo simplesmente não é emitido.
  */
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : {},
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Sem isso o Google limita thumbnail e trecho — custa CTR.
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F7A5F",
};
/**
 * Layout raiz: só o documento. O chrome de cada área vive no grupo de rota
 * correspondente — (site) tem header e rodapé, (auth) tem barra mínima, e
 * /app tem a barra da conta.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${jakarta.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": abs("/#organization"),
                name: site.name,
                url: site.url,
                description: site.description,
                logo: abs("/mascote.jpg"),
                // Quem responde e por onde falar. Em conteúdo jurídico o
                // buscador avalia procedência antes de posição — organização
                // sem contato e sem página de "quem somos" é indistinguível
                // de fazenda de conteúdo.
                email: operador.email,
                contactPoint: {
                  "@type": "ContactPoint",
                  contactType: "customer support",
                  email: operador.email,
                  availableLanguage: ["pt-BR"],
                },
                areaServed: "BR",
                knowsAbout: [
                  "Exame de Ordem",
                  "OAB",
                  "Direito brasileiro",
                  "Legislação brasileira",
                ],
              },
              {
                "@type": "WebSite",
                "@id": abs("/#website"),
                url: site.url,
                name: site.name,
                inLanguage: "pt-BR",
                publisher: { "@id": abs("/#organization") },
              },
            ],
          }}
        />
        {children}
      </body>
    </html>
  );
}
