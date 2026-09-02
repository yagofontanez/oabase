import type { MetadataRoute } from "next";
import { abs } from "@/lib/site";
import { contarParticoes } from "@/lib/content/urls";

export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const particoes = await contarParticoes();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // A fronteira do produto, repetida aqui de propósito: metadata da
      // rota e robots.txt bloqueiam de formas diferentes, e nenhum dos
      // dois deve ser o único mecanismo.
      //
      // `Disallow: /app` casaria por prefixo e levaria junto
      // `/apple-icon.png`. São duas regras: a rota exata, ancorada com `$`,
      // e tudo que desce dela.
      disallow: [
        "/app$",
        "/app/",
        "/entrar",
        "/criar-conta",
        "/checkout",
        "/api",
      ],
    },
    // O índice primeiro, as partições depois — e nenhum `/sitemap.xml`:
    // aquele caminho responde 404 e não há como mudar isso (ver a nota no
    // `netlify.toml`; foi tentado). Anunciar endereço que não responde é
    // pior do que anunciar um só.
    //
    // O índice é o endereço para enviar ao Search Console: quando a base
    // passar de 50 mil URLs e nascer o `1.xml`, ele passa a listar as duas
    // partições sozinho, sem reenviar nada.
    sitemap: [
      abs("/sitemap-index.xml"),
      ...Array.from({ length: particoes }, (_, i) => abs(`/sitemap/${i}.xml`)),
    ],
  };
}
