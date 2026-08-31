import type { MetadataRoute } from "next";
import { abs } from "@/lib/site";
import {
  URLS_POR_SITEMAP,
  contarParticoes,
  getUrlsIndexaveis,
} from "@/lib/content/urls";

export const revalidate = 3600;

/**
 * Particionamento. Hoje gera um único /sitemap/0.xml, mas quando a base
 * de legislação passar de 50 mil URLs o número de arquivos cresce sozinho
 * — sem precisar reescrever nada.
 */
export async function generateSitemaps() {
  const total = await contarParticoes();
  return Array.from({ length: total }, (_, id) => ({ id }));
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const urls = await getUrlsIndexaveis();
  // O id chega da rota de metadata como "0.xml", não como número:
  // multiplicar direto produz NaN e o sitemap sai vazio, sem erro nenhum.
  const particao = Number.parseInt(String(id), 10) || 0;
  const inicio = particao * URLS_POR_SITEMAP;

  return urls.slice(inicio, inicio + URLS_POR_SITEMAP).map((entrada) => ({
    url: abs(entrada.path),
    lastModified: entrada.lastModified
      ? new Date(entrada.lastModified)
      : undefined,
    changeFrequency: entrada.changeFrequency,
    priority: entrada.priority,
  }));
}
