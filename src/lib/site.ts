export const site = {
  name: "OABase",
  tagline: "Base de estudos para o Exame da Ordem",
  // Até 155 caracteres: o buscador trunca por volta de 160, e o que passa
  // disso vira reticência no resultado em vez de argumento para o clique.
  description:
    "Legislação artigo por artigo, provas anteriores com gabarito oficial da FGV e estatísticas reais do Exame de Ordem. Estude pelo que mais cai.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://oabase.com.br",
  locale: "pt_BR",
  twitter: "@oabase",
} as const;

/** URL absoluta — canonical, OG e sitemap exigem host completo. */
export function abs(path: string): string {
  return new URL(path, site.url).toString();
}
