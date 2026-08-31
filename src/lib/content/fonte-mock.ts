import { artigos, disciplinas, exames, leis } from "./data";
import type { FonteDeConteudo } from "./fonte";

/** Origem de desenvolvimento: os arrays de `data.ts`. */
export const fonteMock: FonteDeConteudo = {
  async getLeis() {
    return leis;
  },
  async getLei(slug) {
    return leis.find((l) => l.slug === slug) ?? null;
  },
  async getArtigosDaLei(leiSlug) {
    return artigos
      .filter((a) => a.leiSlug === leiSlug)
      .sort((a, b) => b.incidencia - a.incidencia);
  },
  async getArtigo(leiSlug, artigoSlug) {
    return (
      artigos.find((a) => a.leiSlug === leiSlug && a.slug === artigoSlug) ??
      null
    );
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
