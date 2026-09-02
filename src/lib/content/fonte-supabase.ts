import { supabaseAnon } from "@/lib/supabase/client";
import type { FonteDeConteudo } from "./fonte";
import { naOrdemDoCodigo } from "./ordem";
import type {
  Artigo,
  Disciplina,
  Exame,
  Lei,
  Post,
  Sumula,
  Vizinho,
} from "./types";

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

/* O PostgREST devolve no máximo mil linhas por requisição e não avisa quando
   corta — o Código Civil tem 2.081 artigos e sumiria metade em silêncio, que é
   o pior jeito de perder dado. Quem precisa da lista inteira pede por aqui. */
const PAGINA = 1000;

async function todasAsPaginas<T>(
  contexto: string,
  buscar: (
    de: number,
    ate: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const tudo: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await buscar(de, de + PAGINA - 1);
    erro(contexto, error);
    const lote = data ?? [];
    tudo.push(...lote);
    if (lote.length < PAGINA) return tudo;
  }
}

type LinhaPost = {
  slug: string;
  titulo: string;
  resumo: string;
  corpo: string;
  publicado_em: string;
};

const paraPost = (p: LinhaPost): Post => ({
  slug: p.slug,
  titulo: p.titulo,
  resumo: p.resumo,
  corpo: p.corpo,
  publicadoEm: String(p.publicado_em).slice(0, 10),
});

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
    const linhas = await todasAsPaginas<LinhaArtigo>(
      "artigos da lei",
      (de, ate) =>
        supabaseAnon()
          .from("artigos")
          .select(CAMPOS_ARTIGO)
          .eq("leis.slug", leiSlug)
          // Ordem estável no servidor só para o fatiamento por página não
          // repetir nem pular linha; a ordem que a tela usa é a do código.
          .order("id", { ascending: true })
          .range(de, ate) as unknown as PromiseLike<{
          data: LinhaArtigo[] | null;
          error: { message: string } | null;
        }>,
    );
    return naOrdemDoCodigo(linhas.map(paraArtigo));
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

  async contarArtigos(leiSlug) {
    const { count, error } = await supabaseAnon()
      .from("artigos")
      .select("id, leis!inner(slug)", { count: "exact", head: true })
      .eq("leis.slug", leiSlug);
    erro("contagem de artigos", error);
    return count ?? 0;
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
    // A disciplina entra como filtro da consulta, e não como peneira do
    // resultado: ordenar 5.756 artigos por incidência e só então separar por
    // disciplina devolvia quase sempre os mesmos poucos comentados, porque
    // 5.751 empatam em zero e o desempate é arbitrário.
    // Quando o embedding estiver preenchido, isto vira busca por vizinhança
    // em pgvector sem mudar a assinatura.
    const { data, error } = await supabaseAnon()
      .from("artigos")
      .select(CAMPOS_ARTIGO)
      .eq("disciplinas.slug", artigo.disciplinaSlug)
      .neq("slug", artigo.slug)
      .order("incidencia", { ascending: false })
      .limit(limite);
    erro("artigos relacionados", error);
    return ((data ?? []) as unknown as LinhaArtigo[]).map(paraArtigo);
  },

  async getVizinhos(leiSlug, artigoSlug) {
    const base = supabaseAnon();
    const { data: atual, error: erroAtual } = await base
      .from("artigos")
      .select("ordem, lei_id, leis!inner(slug)")
      .eq("leis.slug", leiSlug)
      .eq("slug", artigoSlug)
      .maybeSingle();
    erro("artigo atual", erroAtual);
    if (!atual) return { anterior: null, proximo: null };

    const { ordem, lei_id } = atual as { ordem: number; lei_id: string };
    const lado = (anterior: boolean) =>
      base
        .from("artigos")
        .select("slug, numero")
        .eq("lei_id", lei_id)
        [anterior ? "lt" : "gt"]("ordem", ordem)
        .order("ordem", { ascending: !anterior })
        .limit(1);

    const [antes, depois] = await Promise.all([lado(true), lado(false)]);
    erro("artigo anterior", antes.error);
    erro("próximo artigo", depois.error);
    return {
      anterior: (antes.data?.[0] as Vizinho) ?? null,
      proximo: (depois.data?.[0] as Vizinho) ?? null,
    };
  },

  /**
   * `exames_do_artigo` é `security definer` porque `questoes` exige
   * assinatura e esta consulta roda em página aberta. O que atravessa é
   * contagem por exame — número de questões, nunca enunciado.
   */
  async getIncidenciaDoArtigo(leiSlug, artigoSlug) {
    const base = supabaseAnon();
    const { data: artigo, error: erroArtigo } = await base
      .from("artigos")
      .select("id, leis!inner(slug)")
      .eq("leis.slug", leiSlug)
      .eq("slug", artigoSlug)
      .maybeSingle();
    erro("artigo para incidência", erroArtigo);
    if (!artigo) return [];

    const { data, error } = await base.rpc("exames_do_artigo", {
      p_artigo_id: (artigo as { id: string }).id,
    });
    erro("incidência do artigo", error);

    type Linha = {
      exame_slug: string;
      edicao: number;
      data_prova: string;
      questoes: number;
    };
    return ((data ?? []) as Linha[]).map((l) => ({
      exameSlug: l.exame_slug,
      edicao: l.edicao,
      data: l.data_prova,
      questoes: l.questoes,
    }));
  },

  async getArtigosDoExame(exameSlug) {
    const { data, error } = await supabaseAnon().rpc("artigos_do_exame", {
      p_exame_slug: exameSlug,
    });
    erro("artigos do exame", error);

    type Linha = {
      lei_slug: string;
      lei_sigla: string;
      artigo_slug: string;
      numero: string;
      caput: string;
      questoes: number;
      tem_comentario: boolean;
    };
    return ((data ?? []) as Linha[]).map((l) => ({
      leiSlug: l.lei_slug,
      leiSigla: l.lei_sigla,
      artigoSlug: l.artigo_slug,
      numero: l.numero,
      caput: l.caput,
      questoes: l.questoes,
      temComentario: l.tem_comentario,
    }));
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

  async getSumulas(tribunal) {
    let consulta = supabaseAnon()
      .from("sumulas")
      .select("slug, tribunal, numero, texto, comentario, vinculante, indexavel")
      .order("numero", { ascending: true });
    if (tribunal) consulta = consulta.eq("tribunal", tribunal);
    const { data, error } = await consulta;
    erro("súmulas", error);
    return (data ?? []) as Sumula[];
  },

  async getSumula(slug) {
    const { data, error } = await supabaseAnon()
      .from("sumulas")
      .select("slug, tribunal, numero, texto, comentario, vinculante, indexavel")
      .eq("slug", slug)
      .maybeSingle();
    erro("súmula", error);
    return (data as Sumula | null) ?? null;
  },

  // Rascunho não precisa de filtro aqui: a política de `posts` só devolve
  // linha com `publicado_em` no passado. A regra mora no banco, e uma
  // consulta esquecida no futuro não fura a fila editorial.
  async getPosts() {
    const { data, error } = await supabaseAnon()
      .from("posts")
      .select("slug, titulo, resumo, corpo, publicado_em")
      .order("publicado_em", { ascending: false });
    erro("posts", error);
    return ((data ?? []) as LinhaPost[]).map(paraPost);
  },

  async getPost(slug) {
    const { data, error } = await supabaseAnon()
      .from("posts")
      .select("slug, titulo, resumo, corpo, publicado_em")
      .eq("slug", slug)
      .maybeSingle();
    erro("post", error);
    return data ? paraPost(data as LinhaPost) : null;
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
