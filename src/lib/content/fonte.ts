import type {
  Artigo,
  Disciplina,
  Exame,
  DispositivoDoExame,
  IncidenciaEmExame,
  Lei,
  Post,
  ResultadoDeBusca,
  Sumula,
  Verbete,
  Vizinho,
} from "./types";

/**
 * Contrato entre as páginas e a origem dos dados.
 *
 * Existem duas implementações: os arrays de exemplo e o Supabase. As páginas
 * não sabem qual está ativa — é o que permitiu desenhar o site inteiro antes
 * de existir um banco, e trocar depois sem reescrever nenhuma rota.
 */
export type FonteDeConteudo = {
  getLeis(): Promise<Lei[]>;
  getLei(slug: string): Promise<Lei | null>;
  getArtigosDaLei(leiSlug: string): Promise<Artigo[]>;
  getArtigo(leiSlug: string, artigoSlug: string): Promise<Artigo | null>;
  /** Só o número. Baixar a lei inteira para chamar `.length` custa caro. */
  contarArtigos(leiSlug: string): Promise<number>;
  getArtigosIndexaveis(): Promise<Artigo[]>;
  /** Só os parâmetros de rota dos artigos pré-renderizados no build. */
  getRotasDeArtigosMaisBuscados(
    limite: number,
  ): Promise<{ leiSlug: string; artigoSlug: string }[]>;
  /** Top dispositivos de uma matéria para uma sessão curta de estudo. */
  getArtigosDaDisciplina(disciplinaSlug: string, limite: number): Promise<Artigo[]>;
  getArtigosRelacionados(artigo: Artigo, limite: number): Promise<Artigo[]>;
  /** Artigo anterior e seguinte na mesma lei, para ler o código em sequência. */
  getVizinhos(
    leiSlug: string,
    artigoSlug: string,
  ): Promise<{ anterior: Vizinho | null; proximo: Vizinho | null }>;
  /**
   * Exames em que o artigo já foi cobrado. Alimenta a página aberta de
   * legislação, e por isso devolve só contagem por exame — o enunciado
   * continua atrás da assinatura.
   */
  getIncidenciaDoArtigo(
    leiSlug: string,
    artigoSlug: string,
  ): Promise<IncidenciaEmExame[]>;
  /**
   * Artigos cobrados numa edição. É o caminho inverso de
   * `getIncidenciaDoArtigo` — sem ele, a ficha do exame não leva a lugar
   * nenhum e as páginas profundas ficam sem caminho de rastreio.
   */
  getArtigosDoExame(exameSlug: string): Promise<DispositivoDoExame[]>;
  /**
   * Súmulas em vigor, do tribunal pedido ou de todos. Texto oficial: a
   * página existe mesmo sem comentário, e o portão de qualidade decide
   * apenas se ela entra no índice.
   */
  getSumulas(tribunal?: Sumula["tribunal"]): Promise<Sumula[]>;
  getSumula(slug: string): Promise<Sumula | null>;
  /**
   * Glossário inteiro, em ordem alfabética. Verbete cujo artigo não está no
   * acervo não sai daqui: definição apontando para o nada é pior do que
   * verbete nenhum, e o `!inner` do join é quem garante isso.
   */
  getGlossario(): Promise<Verbete[]>;
  /**
   * Busca do site: artigo, súmula e post, em uma lista só.
   *
   * Quem ordena artigo e súmula é `buscar_dispositivos` no banco — a mesma
   * função que o quadro de anotações usa, e o primeiro consumidor de
   * `artigos.search_vector`.
   */
  buscarNoSite(termo: string, limite?: number): Promise<ResultadoDeBusca[]>;
  /** Posts publicados, do mais recente para o mais antigo. */
  getPosts(): Promise<Post[]>;
  getPost(slug: string): Promise<Post | null>;
  /**
   * Distribuição por disciplina de uma edição, calculada da classificação
   * que existir. Vem separada de `getExame` porque é a única informação da
   * ficha que não é medição: a tela precisa poder dizer de onde ela veio.
   */
  getDistribuicaoDoExame(
    exameSlug: string,
  ): Promise<{ disciplinaSlug: string; disciplinaNome: string; questoes: number }[]>;
  getExames(): Promise<Exame[]>;
  getExame(slug: string): Promise<Exame | null>;
  getDisciplinas(): Promise<Disciplina[]>;
  getDisciplina(slug: string): Promise<Disciplina | null>;
};
