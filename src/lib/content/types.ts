/**
 * Tipos espelhando o schema do Supabase. Hoje alimentados por mock;
 * quando o banco existir, só `queries.ts` muda — as páginas não.
 */

export type Disciplina = {
  slug: string;
  nome: string;
  /** Média de questões por prova — dado que sustenta /estatisticas */
  mediaPorProva: number;
};

export type Lei = {
  slug: string;
  nome: string;
  sigla: string;
  ano: number;
  /** Frase de contexto usada no hub e na meta description */
  resumo: string;
};

/** O bastante para montar o link de "artigo anterior / próximo". */
export type Vizinho = { slug: string; numero: string };

export type Artigo = {
  leiSlug: string;
  slug: string;
  numero: string;
  caput: string;
  paragrafos: string[];
  /** Comentário autoral — o diferencial. Vazio = ainda não redigido. */
  comentario: string[];
  /** Quantas vezes o artigo já foi cobrado no exame */
  incidencia: number;
  disciplinaSlug: string;
  atualizadoEm: string;
  /**
   * Portão de qualidade: só entra no sitemap e recebe `index`
   * quando o comentário passa do limiar de revisão.
   */
  indexavel: boolean;
};

export type Exame = {
  slug: string;
  edicao: number;
  ano: number;
  /** ISO date da 1ª fase */
  data: string;
  totalQuestoes: number;
  /** Quantas questões deste exame já estão no banco. 0 = não ingerido. */
  questoesCarregadas: number;
  questoesAnuladas: number;
  /** false = gabarito preliminar; a OAB não publicou definitivo para a edição. */
  gabaritoDefinitivo: boolean;
  /** Só existe quando a classificação por disciplina foi confirmada. */
  distribuicao: { disciplinaSlug: string; questoes: number }[];
};

/** Em que exames um artigo já foi cobrado. Contagem, nunca enunciado. */
export type IncidenciaEmExame = {
  exameSlug: string;
  edicao: number;
  data: string;
  questoes: number;
};
