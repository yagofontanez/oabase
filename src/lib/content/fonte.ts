import type { Artigo, Disciplina, Exame, Lei } from "./types";

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
  getArtigosIndexaveis(): Promise<Artigo[]>;
  getArtigosMaisBuscados(limite: number): Promise<Artigo[]>;
  getArtigosRelacionados(artigo: Artigo, limite: number): Promise<Artigo[]>;
  getExames(): Promise<Exame[]>;
  getExame(slug: string): Promise<Exame | null>;
  getDisciplinas(): Promise<Disciplina[]>;
  getDisciplina(slug: string): Promise<Disciplina | null>;
};
