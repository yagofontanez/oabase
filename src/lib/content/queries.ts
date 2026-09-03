import { cache } from "react";
import { supabaseAnon, supabaseConfigurado } from "@/lib/supabase/client";
import { aplicacoes } from "./data";
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

export const getSumulas = cache((tribunal?: "stf" | "stj" | "tst" | "tse") =>
  fonte.getSumulas(tribunal),
);
export const getSumula = cache((slug: string) => fonte.getSumula(slug));

export const getGlossario = cache(() => fonte.getGlossario());

export const getPosts = cache(() => fonte.getPosts());
export const getPost = cache((slug: string) => fonte.getPost(slug));

export const getDistribuicaoDoExame = cache((exameSlug: string) =>
  fonte.getDistribuicaoDoExame(exameSlug),
);

export const getExames = cache(() => fonte.getExames());

/**
 * Tamanho do acervo, medido — nunca escrito à mão.
 *
 * Existe porque o número já apareceu em duas telas com valores diferentes:
 * a landing somava os exames ingeridos e a moldura das telas de conta trazia
 * "1.120" fixo, que envelheceu no dia em que a ingestão passou a cobrir da 3ª
 * edição em diante. Número de vitrine que não sai do dado é promessa com
 * prazo de validade.
 */
export const getAcervo = cache(async () => {
  const ingeridos = (await getExames()).filter((e) => e.questoesCarregadas > 0);
  return {
    exames: ingeridos.length,
    questoes: ingeridos.reduce((s, e) => s + e.questoesCarregadas, 0),
  };
});
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
 *
 * "Próxima" é decidida na leitura, contra o dia de hoje, e não escrita à mão:
 * a edição sai de cena sozinha no dia seguinte à aplicação. Compara-se em
 * texto ISO de propósito — `new Date("YYYY-MM-DD")` é UTC e voltaria um dia
 * em fuso brasileiro, que é exatamente o erro que faria a prova "acontecer"
 * na véspera.
 */
export const getProximoExame = cache(async (hoje = new Date()) => {
  const dia = [
    hoje.getFullYear(),
    String(hoje.getMonth() + 1).padStart(2, "0"),
    String(hoje.getDate()).padStart(2, "0"),
  ].join("-");
  // Sem próxima aplicação publicada, a última continua valendo: a contagem
  // trava em zero e fica visível que o calendário precisa ser atualizado.
  return (
    aplicacoes.find((e) => e.data >= dia) ?? aplicacoes[aplicacoes.length - 1]
  );
});

/**
 * O calendário inteiro que a OAB publicou, e não só a próxima aplicação.
 *
 * `/proximo-exame` precisa da lista completa: quem perdeu a inscrição de uma
 * edição quer saber quando é a seguinte, e mostrar só a primeira transformaria
 * a página numa contagem regressiva sem serventia no dia seguinte à prova.
 *
 * A comparação em texto ISO é a mesma de `getProximoExame` e pelo mesmo
 * motivo: `new Date("YYYY-MM-DD")` é UTC e antecipa a virada em fuso
 * brasileiro.
 */
export const getAplicacoes = cache(async (hoje = new Date()) => {
  const dia = [
    hoje.getFullYear(),
    String(hoje.getMonth() + 1).padStart(2, "0"),
    String(hoje.getDate()).padStart(2, "0"),
  ].join("-");
  return aplicacoes.map((a) => ({ ...a, passou: a.data < dia }));
});

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
