export const site = {
  name: "OABase",
  tagline: "Base de estudos para o Exame da Ordem",
  description:
    "Legislação comentada, súmulas e estatísticas reais dos exames da OAB. Estude com o que mais cai — e treine no banco completo de questões comentadas.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://oabase.com.br",
  locale: "pt_BR",
  twitter: "@oabase",
} as const;

/** URL absoluta — canonical, OG e sitemap exigem host completo. */
export function abs(path: string): string {
  return new URL(path, site.url).toString();
}
