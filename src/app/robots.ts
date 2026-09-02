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
    // As partições são listadas uma a uma, e é aqui que o Google as
    // descobre. Não existe `/sitemap.xml`: com `generateSitemaps`, o Next
    // publica em `/sitemap/0.xml` e reserva o caminho convencional para a
    // própria convenção de metadata — uma rota ali quebra o build. Ao
    // submeter no Search Console, use o endereço que sai deste arquivo.
    sitemap: Array.from({ length: particoes }, (_, i) =>
      abs(`/sitemap/${i}.xml`),
    ),
  };
}
