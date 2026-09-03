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
  /** Disciplina a que a norma pertence. Nulo quando ninguém declarou. */
  disciplinaSlug: string | null;
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

/**
 * Verbete do glossário. Não há campo de definição escrita: **a definição é o
 * artigo**, exibido literal e com link para o texto completo. O que é autoral
 * aqui é a curadoria — qual termo merece verbete e onde ele está definido —,
 * que é trabalho de índice, não de doutrina.
 *
 * Guardar uma cópia do caput na linha do verbete criaria duas verdades que
 * sairiam de sincronia na primeira alteração da lei.
 */
export type Verbete = {
  slug: string;
  termo: string;
  disciplinaSlug: string;
  disciplinaNome: string;
  leiSlug: string;
  leiSigla: string;
  artigoSlug: string;
  /** Número do artigo que define o termo. */
  numero: string;
  /** Texto do dispositivo, literal. É a definição. */
  caput: string;
  /** O artigo já tem comentário autoral — vale a visita. */
  temComentario: boolean;
  /**
   * Questões que citaram o dispositivo de forma expressa — `artigos.incidencia`,
   * que conta só `citacao` e `humano`. É o mesmo número da página de legislação,
   * e é o que transforma o glossário de índice em ordem de estudo: quem abre na
   * véspera precisa saber qual dos 142 termos a banca de fato nomeia.
   *
   * Não é `incidencia_estimada`: aqui a página é aberta, e o número precisa
   * sobreviver a alguém reler a questão para conferir.
   */
  incidencia: number;
};

/**
 * Uma linha de resultado da busca do site.
 *
 * Deliberadamente plana e sem o registro de origem: a página de busca não
 * precisa saber que artigo veio de `buscar_dispositivos` e post veio de uma
 * filtragem em memória. `tipo` existe para rotular na tela — "Artigo",
 * "Súmula", "Texto" —, não para ramificar comportamento.
 */
export type ResultadoDeBusca = {
  tipo: "artigo" | "sumula" | "post";
  rotulo: string;
  resumo: string;
  href: string;
  /** Tem comentário autoral — o que distingue esta página das cópias. */
  comentado: boolean;
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
