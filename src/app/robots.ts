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
      disallow: ["/app", "/entrar", "/criar-conta", "/checkout", "/api"],
    },
    sitemap: Array.from({ length: particoes }, (_, i) =>
      abs(`/sitemap/${i}.xml`),
    ),
  };
}
