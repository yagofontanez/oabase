import { supabaseAnon } from "@/lib/supabase/client";
import type { FonteDeConteudo } from "./fonte";
import type { Artigo, Disciplina, Exame, Lei } from "./types";

/* As consultas usam a chave anônima: o RLS é quem garante que só o conteúdo
   aberto sai daqui. Ver src/lib/supabase/client.ts. */

const CAMPOS_ARTIGO =
  "numero, slug, caput, paragrafos, comentario, incidencia, indexavel, atualizado_em, leis!inner(slug), disciplinas(slug)";

type LinhaArtigo = {
  numero: string;
  slug: string;
  caput: string;
  paragrafos: string[] | null;
  comentario: string[] | null;
  incidencia: number;
  indexavel: boolean;
  atualizado_em: string;
  leis: { slug: string } | { slug: string }[];
  disciplinas: { slug: string } | { slug: string }[] | null;
};

/** PostgREST devolve relação como objeto ou array conforme a cardinalidade. */
function um<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function paraArtigo(linha: LinhaArtigo): Artigo {
  return {
    leiSlug: um(linha.leis)?.slug ?? "",
    slug: linha.slug,
    numero: linha.numero,
    caput: linha.caput,
    paragrafos: linha.paragrafos ?? [],
    comentario: linha.comentario ?? [],
    incidencia: linha.incidencia,
    disciplinaSlug: um(linha.disciplinas)?.slug ?? "",
    // A coluna é timestamptz; as páginas trabalham com data pura.
    atualizadoEm: linha.atualizado_em.slice(0, 10),
    indexavel: linha.indexavel,
  };
}

function erro(contexto: string, e: { message: string } | null): void {
  if (e) throw new Error(`Supabase (${contexto}): ${e.message}`);
}

export const fonteSupabase: FonteDeConteudo = {
  async getLeis() {
    const { data, error } = await supabaseAnon()
      .from("leis")
      .select("slug, nome, sigla, ano, resumo")
      .order("ano", { ascending: false });
    erro("leis", error);
    return (data ?? []) as Lei[];
  },

  async getLei(slug) {
    const { data, error } = await supabaseAnon()
      .from("leis")
      .select("slug, nome, sigla, ano, resumo")
      .eq("slug", slug)
      .maybeSingle();
    erro("lei", error);
    return (data as Lei) ?? null;
  },

  async getArtigosDaLei(leiSlug) {
    const { data, error } = await supabaseAnon()
      .from("artigos")
      .select(CAMPOS_ARTIGO)
      .eq("leis.slug", leiSlug)
      .order("incidencia", { ascending: false });
    erro("artigos da lei", error);
    return ((data ?? []) as unknown as LinhaArtigo[]).map(paraArtigo);
  },

  async getArtigo(leiSlug, artigoSlug) {
    const { data, error } = await supabaseAnon()
      .from("artigos")
      .select(CAMPOS_ARTIGO)
      .eq("leis.slug", leiSlug)
      .eq("slug", artigoSlug)
      .maybeSingle();
    erro("artigo", error);
    return data ? paraArtigo(data as unknown as LinhaArtigo) : null;
  },

  async getArtigosIndexaveis() {
    const { data, error } = await supabaseAnon()
      .from("artigos")
      .select(CAMPOS_ARTIGO)
      .eq("indexavel", true)
      .order("incidencia", { ascending: false });
    erro("artigos indexáveis", error);
    return ((data ?? []) as unknown as LinhaArtigo[]).map(paraArtigo);
  },

  async getArtigosMaisBuscados(limite) {
    const { data, error } = await supabaseAnon()
      .from("artigos")
      .select(CAMPOS_ARTIGO)
      .order("incidencia", { ascending: false })
      .limit(limite);
    erro("artigos mais buscados", error);
    return ((data ?? []) as unknown as LinhaArtigo[]).map(paraArtigo);
  },

  async getArtigosRelacionados(artigo, limite) {
    // Hoje por disciplina; quando o embedding estiver preenchido, vira uma
    // busca por vizinhança em pgvector sem mudar a assinatura.
    const { data, error } = await supabaseAnon()
      .from("artigos")
      .select(CAMPOS_ARTIGO)
      .neq("slug", artigo.slug)
      .order("incidencia", { ascending: false })
      .limit(limite * 3);
    erro("artigos relacionados", error);

    const todos = ((data ?? []) as unknown as LinhaArtigo[]).map(paraArtigo);
    const mesmaDisciplina = todos.filter(
      (a) => a.disciplinaSlug === artigo.disciplinaSlug,
    );
    const resto = todos.filter(
      (a) => a.disciplinaSlug !== artigo.disciplinaSlug,
    );
    return [...mesmaDisciplina, ...resto].slice(0, limite);
  },

  async getExames() {
    const { data, error } = await supabaseAnon()
      .from("exames")
      .select(
        "slug, edicao, ano, data_prova, total_questoes, questoes_carregadas, questoes_anuladas, gabarito_definitivo, exame_disciplinas(questoes, disciplinas!inner(slug))",
      )
      .order("edicao", { ascending: false });
    erro("exames", error);
    return ((data ?? []) as unknown[]).map(paraExame);
  },

  async getExame(slug) {
    const { data, error } = await supabaseAnon()
      .from("exames")
      .select(
        "slug, edicao, ano, data_prova, total_questoes, questoes_carregadas, questoes_anuladas, gabarito_definitivo, exame_disciplinas(questoes, disciplinas!inner(slug))",
      )
      .eq("slug", slug)
      .maybeSingle();
    erro("exame", error);
    return data ? paraExame(data) : null;
  },

  async getDisciplinas() {
    const { data, error } = await supabaseAnon()
      .from("disciplinas")
      .select("slug, nome, media_por_prova")
      .order("media_por_prova", { ascending: false });
    erro("disciplinas", error);
    return (
      (data ?? []) as { slug: string; nome: string; media_por_prova: number }[]
    ).map((d) => ({
      slug: d.slug,
      nome: d.nome,
      mediaPorProva: Number(d.media_por_prova),
    }));
  },

  async getDisciplina(slug) {
    const { data, error } = await supabaseAnon()
      .from("disciplinas")
      .select("slug, nome, media_por_prova")
      .eq("slug", slug)
      .maybeSingle();
    erro("disciplina", error);
    if (!data) return null;
    const d = data as { slug: string; nome: string; media_por_prova: number };
    return {
      slug: d.slug,
      nome: d.nome,
      mediaPorProva: Number(d.media_por_prova),
    } as Disciplina;
  },
};

type LinhaExame = {
  slug: string;
  edicao: number;
  ano: number;
  data_prova: string;
  total_questoes: number;
  questoes_carregadas: number;
  questoes_anuladas: number;
  gabarito_definitivo: boolean;
  exame_disciplinas: {
    questoes: number;
    disciplinas: { slug: string } | { slug: string }[] | null;
  }[];
};

function paraExame(linha: unknown): Exame {
  const e = linha as LinhaExame;
  return {
    slug: e.slug,
    edicao: e.edicao,
    ano: e.ano,
    data: e.data_prova,
    totalQuestoes: e.total_questoes,
    questoesCarregadas: e.questoes_carregadas ?? 0,
    questoesAnuladas: e.questoes_anuladas ?? 0,
    gabaritoDefinitivo: Boolean(e.gabarito_definitivo),
    distribuicao: (e.exame_disciplinas ?? [])
      .map((d) => ({
        disciplinaSlug: um(d.disciplinas)?.slug ?? "",
        questoes: d.questoes,
      }))
      .sort((a, b) => b.questoes - a.questoes),
  };
}
