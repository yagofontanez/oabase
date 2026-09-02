import { cache } from "react";
import { supabaseAnon, supabaseConfigurado } from "@/lib/supabase/client";
import { proximoExame } from "./data";
import { fonteMock } from "./fonte-mock";
import { fonteSupabase } from "./fonte-supabase";

/* ------------------------------------------------------------------
   Ponto único de acesso a dados.

   Com credenciais do Supabase no ambiente, lê do banco; sem elas, cai
   para os dados de exemplo. As páginas não mudam nos dois casos — foi
   essa fronteira que permitiu desenhar o site antes de existir banco.

   Tudo envolvido em `cache()` do React: `generateMetadata` e o componente
   da página pedem o mesmo dado e só uma leitura acontece por requisição.
   ------------------------------------------------------------------ */

const fonte = supabaseConfigurado ? fonteSupabase : fonteMock;

export const getLeis = cache(() => fonte.getLeis());
export const getLei = cache((slug: string) => fonte.getLei(slug));
export const getArtigosDaLei = cache((leiSlug: string) =>
  fonte.getArtigosDaLei(leiSlug),
);
export const contarArtigos = cache((leiSlug: string) =>
  fonte.contarArtigos(leiSlug),
);
export const getArtigo = cache((leiSlug: string, artigoSlug: string) =>
  fonte.getArtigo(leiSlug, artigoSlug),
);

/**
 * Só o que passou do portão de qualidade editorial.
 * É esta lista — e nunca a tabela inteira — que alimenta o sitemap.
 */
export const getArtigosIndexaveis = cache(() => fonte.getArtigosIndexaveis());

/**
 * Top-N por incidência, para `generateStaticParams`. As demais páginas são
 * geradas sob demanda via `dynamicParams` e ficam em cache depois da
 * primeira visita — é o que impede o build de explodir quando a base
 * chegar a dezenas de milhares de URLs.
 */
export const getArtigosMaisBuscados = cache((limite = 500) =>
  fonte.getArtigosMaisBuscados(limite),
);

export const getVizinhos = cache((leiSlug: string, artigoSlug: string) =>
  fonte.getVizinhos(leiSlug, artigoSlug),
);
export const getArtigosRelacionados = cache(
  (artigo: Parameters<typeof fonte.getArtigosRelacionados>[0], limite = 4) =>
    fonte.getArtigosRelacionados(artigo, limite),
);

export const getExames = cache(() => fonte.getExames());
export const getExame = cache((slug: string) => fonte.getExame(slug));
export const getDisciplinas = cache(() => fonte.getDisciplinas());

/**
 * Disciplinas com o id do banco — o seletor do modo foco precisa dele para
 * gravar `sessoes_foco.disciplina_id`. Fica separado de `getDisciplinas`
 * porque expor id no tipo público não serve para mais nada.
 */
export const getDisciplinasComId = cache(
  async (): Promise<{ id: string; slug: string; nome: string }[]> => {
    if (!supabaseConfigurado) return [];
    const { data } = await supabaseAnon()
      .from("disciplinas")
      .select("id, slug, nome")
      .order("media_por_prova", { ascending: false });
    return (data ?? []) as { id: string; slug: string; nome: string }[];
  },
);
export const getDisciplina = cache((slug: string) => fonte.getDisciplina(slug));

/**
 * A próxima prova é data de calendário, não conteúdo: ela existe antes de
 * o exame acontecer e não tem distribuição para registrar. Fica como
 * configuração do app até virar uma edição de verdade na tabela.
 */
export const getProximoExame = cache(async () => proximoExame);

/** Dias até a próxima prova, sem deixar o fuso interferir na contagem. */
export function diasAte(iso: string, hoje = new Date()): number {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const alvo = new Date(ano, mes - 1, dia);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.max(
    0,
    Math.round((alvo.getTime() - base.getTime()) / 86_400_000),
  );
}

export const getIncidenciaDoArtigo = cache(
  (leiSlug: string, artigoSlug: string) =>
    fonte.getIncidenciaDoArtigo(leiSlug, artigoSlug),
);

export const getArtigosDoExame = cache((exameSlug: string) =>
  fonte.getArtigosDoExame(exameSlug),
);
