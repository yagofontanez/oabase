import { daLei, formatarNumeroDeArtigo } from "../format";
import type { Artigo, Lei } from "./types";

const LIMITE_DA_DESCRICAO = 155;

const PONTUACAO_WINDOWS_1252: Record<string, string> = {
  "\u0085": "…",
  "\u0091": "‘",
  "\u0092": "’",
  "\u0093": "“",
  "\u0094": "”",
  "\u0095": "•",
  "\u0096": "–",
  "\u0097": "—",
};

/**
 * O Planalto ainda entrega alguns bytes de Windows-1252 como controles C1.
 * No corpo legal eles ficam preservados até a revisão da fonte; na metadata,
 * porém, um `\u0096` aparecia como caractere quebrado no snippet do art. 155.
 */
export function limparTextoDeMetadata(texto: string): string {
  return texto
    .replace(/[\u0080-\u009f]/g, (caractere) =>
      PONTUACAO_WINDOWS_1252[caractere] ?? " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function resumoAutomatico(lei: Lei, artigo: Artigo): string {
  const prefixo = `Art. ${formatarNumeroDeArtigo(artigo.numero)} ${daLei(lei.nome)} ${lei.nome} comentado para a OAB: `;
  const caput = limparTextoDeMetadata(artigo.caput);
  const sobra = LIMITE_DA_DESCRICAO - prefixo.length - 1;
  if (caput.length <= sobra) return prefixo + caput;

  const cortado = caput.slice(0, Math.max(sobra, 0));
  const espaco = cortado.lastIndexOf(" ");
  const trecho = espaco > 40 ? cortado.slice(0, espaco) : cortado;
  return `${prefixo}${trecho.trimEnd()}…`;
}

export function metadadosDoArtigo(lei: Lei, artigo: Artigo) {
  const tituloAutomatico = `Art. ${formatarNumeroDeArtigo(artigo.numero)} ${daLei(lei.nome)} ${lei.nome} — comentado`;
  return {
    titulo: limparTextoDeMetadata(artigo.seoTitulo || tituloAutomatico),
    descricao: limparTextoDeMetadata(
      artigo.seoDescricao || resumoAutomatico(lei, artigo),
    ),
  };
}

type LinkEditorial = { href: string; rotulo: string };

const LINKS_EDITORIAIS: Record<string, LinkEditorial[]> = {
  "codigo-penal/artigo-155": [
    {
      href: "/legislacao/codigo-penal/artigo-157",
      rotulo: "Compare o furto com o roubo do art. 157 do Código Penal",
    },
  ],
  "codigo-penal/artigo-157": [
    {
      href: "/legislacao/codigo-penal/artigo-155",
      rotulo: "Veja a diferença para o furto do art. 155 do Código Penal",
    },
  ],
};

export function getLinksEditoriaisDoArtigo(
  leiSlug: string,
  artigoSlug: string,
): LinkEditorial[] {
  return LINKS_EDITORIAIS[`${leiSlug}/${artigoSlug}`] ?? [];
}
