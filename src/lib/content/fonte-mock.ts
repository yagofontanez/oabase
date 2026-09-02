import { artigos, disciplinas, exames, leis } from "./data";
import type { FonteDeConteudo } from "./fonte";
import { naOrdemDoCodigo } from "./ordem";

/** Origem de desenvolvimento: os arrays de `data.ts`. */
export const fonteMock: FonteDeConteudo = {
  async getLeis() {
    return leis;
  },
  async getLei(slug) {
    return leis.find((l) => l.slug === slug) ?? null;
  },
  async getArtigosDaLei(leiSlug) {
    return naOrdemDoCodigo(artigos.filter((a) => a.leiSlug === leiSlug));
  },
  async getArtigo(leiSlug, artigoSlug) {
    return (
      artigos.find((a) => a.leiSlug === leiSlug && a.slug === artigoSlug) ??
      null
    );
  },
  async contarArtigos(leiSlug) {
    return artigos.filter((a) => a.leiSlug === leiSlug).length;
  },
  async getArtigosIndexaveis() {
    return artigos.filter((a) => a.indexavel);
  },
  async getArtigosMaisBuscados(limite) {
    return [...artigos]
      .sort((a, b) => b.incidencia - a.incidencia)
      .slice(0, limite);
  },
  async getArtigosRelacionados(artigo, limite) {
    return artigos
      .filter(
        (a) =>
          a.disciplinaSlug === artigo.disciplinaSlug && a.slug !== artigo.slug,
      )
      .concat(artigos.filter((a) => a.disciplinaSlug !== artigo.disciplinaSlug))
      .filter((a) => a.slug !== artigo.slug)
      .slice(0, limite);
  },
  async getVizinhos(leiSlug, artigoSlug) {
    const daLei = naOrdemDoCodigo(artigos.filter((a) => a.leiSlug === leiSlug));
    const i = daLei.findIndex((a) => a.slug === artigoSlug);
    const em = (n: number) => {
      const a = daLei[n];
      return a ? { slug: a.slug, numero: a.numero } : null;
    };
    return i < 0
      ? { anterior: null, proximo: null }
      : { anterior: em(i - 1), proximo: em(i + 1) };
  },
  // Sem banco não há acervo de questões para contar. Zero é a resposta
  // honesta — inventar incidência aqui reproduziria exatamente o placeholder
  // que este recurso existe para eliminar.
  async getIncidenciaDoArtigo() {
    return [];
  },
  // Sem banco não há vínculo questão-artigo para listar.
  async getArtigosDoExame() {
    return [];
  },
  // Súmula é texto oficial de tribunal: ou vem da ingestão, ou não existe.
  // Escrever enunciado de exemplo aqui seria criar direito de mentira, que é
  // pior do que uma lista vazia no ambiente sem banco.
  async getSumulas() {
    return [];
  },
  async getSumula() {
    return null;
  },
  // Post é texto autoral: ou alguém escreveu, ou não existe.
  async getPosts() {
    return [];
  },
  async getPost() {
    return null;
  },
  async getExames() {
    return [...exames].sort((a, b) => b.edicao - a.edicao);
  },
  async getExame(slug) {
    return exames.find((e) => e.slug === slug) ?? null;
  },
  async getDisciplinas() {
    return [...disciplinas].sort((a, b) => b.mediaPorProva - a.mediaPorProva);
  },
  async getDisciplina(slug) {
    return disciplinas.find((d) => d.slug === slug) ?? null;
  },
};
