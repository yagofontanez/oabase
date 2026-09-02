import { abs } from "@/lib/site";
import { contarParticoes } from "@/lib/content/urls";

export const revalidate = 3600;

/**
 * Índice de sitemaps — o endereço estável.
 *
 * Com `generateSitemaps`, o Next publica as partições em `/sitemap/0.xml`,
 * `/sitemap/1.xml`… e **reserva `/sitemap.xml` para a própria convenção de
 * metadata**: uma rota ali derruba o build com "Conflicting route and
 * metadata". Por isso o índice mora aqui, e `netlify.toml` reescreve
 * `/sitemap.xml` para este caminho — a pessoa digita o endereço de sempre e
 * recebe um índice de verdade.
 *
 * Índice, e não redirecionamento para a partição zero: quando a base de
 * legislação passar de 50 mil URLs e nascer o `1.xml`, quem só conhece este
 * endereço continua achando tudo, sem reenviar nada no Search Console.
 */
export async function GET() {
  const particoes = await contarParticoes();

  const corpo =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    Array.from(
      { length: particoes },
      (_, i) => `<sitemap><loc>${abs(`/sitemap/${i}.xml`)}</loc></sitemap>\n`,
    ).join("") +
    "</sitemapindex>\n";

  return new Response(corpo, {
    headers: {
      "content-type": "application/xml",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
