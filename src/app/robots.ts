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
    // O índice primeiro, as partições depois. Não é redundância inútil: o
    // índice vive numa reescrita do `netlify.toml` (o Next reserva
    // `/sitemap.xml` para a convenção de metadata e quebra o build se houver
    // rota ali), e uma configuração de hospedagem é justamente o tipo de
    // coisa que some numa migração sem ninguém perceber. Listadas as duas
    // formas, o Google acha o conteúdo pelos dois caminhos.
    sitemap: [
      abs("/sitemap.xml"),
      ...Array.from({ length: particoes }, (_, i) => abs(`/sitemap/${i}.xml`)),
    ],
  };
}
