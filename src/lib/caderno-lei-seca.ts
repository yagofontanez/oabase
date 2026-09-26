export const CORES_DO_DESTAQUE = ["amarelo", "verde", "rosa"] as const;

export type CorDoDestaque = (typeof CORES_DO_DESTAQUE)[number];

export type DestaqueLeiSeca = {
  inicio: number;
  fim: number;
  trecho: string;
  cor: CorDoDestaque;
};

export type EstadoDoCaderno = {
  artigoId: string;
  nota: string;
  lido: boolean;
  revisarEm: string | null;
  favorito: boolean;
  importantePara: string;
  vistoEmQuestao: boolean;
  destaques: DestaqueLeiSeca[];
};

export type ItemDoCaderno = {
  artigoId: string;
  leiSlug: string;
  leiNome: string;
  leiSigla: string;
  artigoSlug: string;
  numero: string;
  caput: string;
  /** Parágrafos, incisos e alíneas — para ouvir o artigo inteiro. */
  paragrafos: string[];
  nota: string;
  lidoEm: string | null;
  revisarEm: string | null;
  favorito: boolean;
  importantePara: string;
  vistoEmQuestao: boolean;
  atualizadoEm: string;
  destaques: number;
};

export type SegmentoDestacado = {
  texto: string;
  destaque: DestaqueLeiSeca | null;
};

/**
 * Recorta uma parte do artigo sem alterar o texto legal. Os deslocamentos do
 * banco são relativos ao artigo completo; `inicioDaParte` os traz para o
 * caput ou parágrafo que está sendo renderizado.
 */
export function segmentarDestaques(
  texto: string,
  inicioDaParte: number,
  destaques: DestaqueLeiSeca[],
): SegmentoDestacado[] {
  const fimDaParte = inicioDaParte + texto.length;
  const dentro = destaques
    .filter(
      (destaque) =>
        destaque.inicio >= inicioDaParte && destaque.fim <= fimDaParte,
    )
    .sort((a, b) => a.inicio - b.inicio);
  const segmentos: SegmentoDestacado[] = [];
  let cursor = 0;

  for (const destaque of dentro) {
    const inicio = destaque.inicio - inicioDaParte;
    const fim = destaque.fim - inicioDaParte;
    if (inicio < cursor || texto.slice(inicio, fim) !== destaque.trecho) continue;
    if (inicio > cursor) {
      segmentos.push({ texto: texto.slice(cursor, inicio), destaque: null });
    }
    segmentos.push({ texto: texto.slice(inicio, fim), destaque });
    cursor = fim;
  }
  if (cursor < texto.length) {
    segmentos.push({ texto: texto.slice(cursor), destaque: null });
  }
  return segmentos;
}

export function classeDaCor(cor: CorDoDestaque) {
  if (cor === "verde") return "bg-brand-100 text-inherit";
  if (cor === "rosa") return "bg-vinho-100 text-inherit";
  return "bg-ouro-100 text-inherit";
}
