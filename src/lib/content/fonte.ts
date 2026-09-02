import type {
  Artigo,
  Disciplina,
  Exame,
  DispositivoDoExame,
  IncidenciaEmExame,
  Lei,
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
  getArtigosMaisBuscados(limite: number): Promise<Artigo[]>;
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
  getExames(): Promise<Exame[]>;
  getExame(slug: string): Promise<Exame | null>;
  getDisciplinas(): Promise<Disciplina[]>;
  getDisciplina(slug: string): Promise<Disciplina | null>;
};
