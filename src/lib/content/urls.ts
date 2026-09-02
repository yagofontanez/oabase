import type { MetadataRoute } from "next";
import {
  getArtigosIndexaveis,
  getExames,
  getLeis,
  getSumulas,
} from "./queries";

/** Limite do protocolo de sitemap. Acima disso, particionar é obrigatório. */
export const URLS_POR_SITEMAP = 50_000;

type Entrada = MetadataRoute.Sitemap[number];

const ESTATICAS: {
  path: string;
  priority: number;
  changeFrequency: Entrada["changeFrequency"];
}[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/legislacao", priority: 0.9, changeFrequency: "weekly" },
  { path: "/exames", priority: 0.9, changeFrequency: "weekly" },
  // Índice completo e navegável, como o de cada lei — não é cópia de texto
  // solta. As páginas de cada súmula seguem o portão de qualidade e só
  // entram quando tiverem comentário.
  { path: "/sumulas", priority: 0.8, changeFrequency: "monthly" },
  { path: "/estatisticas", priority: 0.8, changeFrequency: "monthly" },
  { path: "/precos", priority: 0.7, changeFrequency: "monthly" },
  // `/sobre` é sinal de procedência: conteúdo jurídico é avaliado por quem
  // assina e com base em quê. Prioridade acima das outras institucionais.
  { path: "/sobre", priority: 0.5, changeFrequency: "monthly" },
  { path: "/termos", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacidade", priority: 0.2, changeFrequency: "yearly" },
];

/**
 * Fonte única de verdade do que é rastreável.
 *
 * Repare no filtro: artigos entram por `getArtigosIndexaveis()`, que só
 * devolve o que passou pela revisão editorial. Uma página sem comentário
 * revisado continua acessível, mas não é anunciada ao Google.
 */
export async function getUrlsIndexaveis(): Promise<
  {
    path: string;
    lastModified?: string;
    priority: number;
    changeFrequency: Entrada["changeFrequency"];
  }[]
> {
  const [leis, artigos, exames, sumulas] = await Promise.all([
    getLeis(),
    getArtigosIndexaveis(),
    getExames(),
    getSumulas(),
  ]);

  return [
    ...ESTATICAS,
    ...leis.map((lei) => ({
      path: `/legislacao/${lei.slug}`,
      priority: 0.8,
      changeFrequency: "monthly" as const,
    })),
    ...artigos.map((artigo) => ({
      path: `/legislacao/${artigo.leiSlug}/${artigo.slug}`,
      lastModified: artigo.atualizadoEm,
      priority: 0.7,
      changeFrequency: "monthly" as const,
    })),
    ...exames.map((exame) => ({
      path: `/exames/${exame.slug}`,
      lastModified: exame.data,
      priority: 0.6,
      changeFrequency: "yearly" as const,
    })),
    // Mesmo filtro dos artigos, e pelo mesmo motivo: o enunciado oficial
    // existe em centenas de sites. Ao índice vai o que tem comentário.
    ...sumulas
      .filter((s) => s.indexavel)
      .map((sumula) => ({
        path: `/sumulas/${sumula.slug}`,
        priority: 0.6,
        changeFrequency: "yearly" as const,
      })),
  ];
}

export async function contarParticoes(): Promise<number> {
  const urls = await getUrlsIndexaveis();
  return Math.max(1, Math.ceil(urls.length / URLS_POR_SITEMAP));
}
