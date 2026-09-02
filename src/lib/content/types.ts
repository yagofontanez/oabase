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

/**
 * Enunciado de súmula. Texto oficial do tribunal, curto e verificável — não
 * depende de ninguém escrever nada para existir, ao contrário do comentário.
 */
export type Sumula = {
  slug: string;
  tribunal: "stf" | "stj" | "tst" | "tse";
  numero: number;
  texto: string;
  comentario: string[];
  vinculante: boolean;
  /** Mesmo portão dos artigos: ao índice só vai o que tem comentário. */
  indexavel: boolean;
};

/**
 * Post do blog. `publicadoEm` nulo não chega até aqui: a política de RLS de
 * `posts` já filtra o que ainda não foi publicado, então rascunho não vaza
 * nem por consulta direta com a chave anônima.
 */
export type Post = {
  slug: string;
  titulo: string;
  resumo: string;
  corpo: string;
  publicadoEm: string;
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

/** Dispositivos que uma prova cobrou. Relação e contagem, nunca enunciado. */
export type DispositivoDoExame = {
  leiSlug: string;
  leiSigla: string;
  artigoSlug: string;
  numero: string;
  caput: string;
  questoes: number;
  temComentario: boolean;
};
