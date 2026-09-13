export const site = {
  name: "OABase",
  tagline: "Seu sistema de estudos em Direito",
  // Até 155 caracteres: o buscador trunca por volta de 160, e o que passa
  // disso vira reticência no resultado em vez de argumento para o clique.
  description:
    "Planeje provas da faculdade ou a OAB, registre seu foco e revise com contexto. Legislação oficial e estudo jurídico no mesmo lugar.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://oabase.com.br",
  locale: "pt_BR",
  twitter: "@oabase",
} as const;

/** URL absoluta — canonical, OG e sitemap exigem host completo. */
export function abs(path: string): string {
  return new URL(path, site.url).toString();
}
