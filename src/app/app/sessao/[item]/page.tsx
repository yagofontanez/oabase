import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SessaoGuiada, type MaterialDaSessao } from "@/components/app/sessao-guiada";
import type { QuestaoDaFila } from "@/components/app/resolvedor";
import { memoriasDosArtigos } from "@/lib/caderno-lei-seca-servidor";
import { getArtigosDaDisciplina, getDisciplinas, getLeis } from "@/lib/content/queries";
import { metaDaLinha } from "@/lib/metas-roadmap";
import { minutosDaSessao, type SessaoEmAndamento } from "@/lib/sessao-estudo";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Sessão de estudo",
  robots: { index: false, follow: false },
};

type LinhaQuestao = {
  id: string;
  numero: number;
  slug: string;
  enunciado: string;
  alternativas: Record<string, string>;
  exame_edicao: number;
  exame_slug: string;
  disciplina_nome: string | null;
  ja_respondida: boolean;
  errou_antes: boolean;
};

type LinhaSessao = {
  id: string;
  roadmap_item_id: string;
  modo_cronometro: "continuo" | "pomodoro";
  minutos_planejados: number;
  segundos_foco: number;
  materiais_lidos: string[];
  checklist: Record<string, boolean>;
  anotacao: string;
  iniciado_em: string;
};

export default async function SessaoPage({
  params,
  searchParams,
}: PageProps<"/app/sessao/[item]">) {
  const [{ item }, consulta] = await Promise.all([params, searchParams]);
  const minutos = minutosDaSessao(
    typeof consulta.minutos === "string" ? consulta.minutos : undefined,
  );
  const supabase = await supabaseServidor();
  const [{ data: plano }, disciplinas, leis] = await Promise.all([
    supabase.from("planos_estudo").select("versao_roadmap").maybeSingle(),
    getDisciplinas(),
    getLeis(),
  ]);
  if (!plano?.versao_roadmap) notFound();

  const [{ data: bloco }, { data: sessaoAberta }] = await Promise.all([
    supabase
      .from("roadmap_itens")
      .select("id, semana, ordem, disciplina, objetivo, horas, estado, anotacao")
      .eq("id", item)
      .eq("versao", plano.versao_roadmap)
      .maybeSingle(),
    supabase
      .from("sessoes_estudo")
      .select(
        "id, roadmap_item_id, modo_cronometro, minutos_planejados, segundos_foco, materiais_lidos, checklist, anotacao, iniciado_em",
      )
      .eq("status", "em_andamento")
      .maybeSingle(),
  ]);
  if (!bloco) notFound();

  const disciplina = disciplinas.find((entrada) => entrada.nome === bloco.disciplina);
  const [artigos, metasRes] = await Promise.all([
    disciplina ? getArtigosDaDisciplina(disciplina.slug, 4) : Promise.resolve([]),
    supabase.rpc("metas_do_bloco", { p_roadmap_item_id: bloco.id }),
  ]);
  if (metasRes.error) {
    throw new Error(`Não foi possível carregar as metas: ${metasRes.error.message}`);
  }
  const metas = ((metasRes.data ?? []) as Record<string, unknown>[]).map(
    metaDaLinha,
  );
  const siglas = new Map(leis.map((lei) => [lei.slug, lei.sigla]));
  const memorias = await memoriasDosArtigos(
    artigos.map((artigo) => ({
      leiSlug: artigo.leiSlug,
      artigoSlug: artigo.slug,
    })),
  );
  const materiais: MaterialDaSessao[] = artigos.map((artigo) => {
    const memoria = memorias[`${artigo.leiSlug}/${artigo.slug}`];
    return {
      id: `/legislacao/${artigo.leiSlug}/${artigo.slug}`,
      rotulo: `Art. ${artigo.numero} ${siglas.get(artigo.leiSlug) ?? ""}`.trim(),
      caput: artigo.caput,
      comentario: artigo.comentario,
      nota: memoria?.nota ?? "",
      destaques: memoria?.destaques ?? [],
    };
  });

  const { data: filaBruta } = disciplina
    ? await supabase.rpc("fila_de_questoes", {
        p_modo: "novas",
        p_exame: null,
        p_disciplina: disciplina.slug,
        p_limite: 5,
      })
    : { data: [] };
  const questoes: QuestaoDaFila[] = ((filaBruta ?? []) as LinhaQuestao[]).map(
    (questao) => ({
      id: questao.id,
      numero: questao.numero,
      slug: questao.slug,
      enunciado: questao.enunciado,
      alternativas: questao.alternativas,
      exameEdicao: questao.exame_edicao,
      exameSlug: questao.exame_slug,
      disciplina: questao.disciplina_nome,
      jaRespondida: questao.ja_respondida,
      errouAntes: questao.errou_antes,
    }),
  );

  const linha = sessaoAberta as LinhaSessao | null;
  const sessaoInicial: SessaoEmAndamento | null =
    linha && linha.roadmap_item_id === bloco.id
      ? {
          id: linha.id,
          roadmapItemId: linha.roadmap_item_id,
          modo: linha.modo_cronometro,
          minutosPlanejados: Number(linha.minutos_planejados),
          segundosFoco: Number(linha.segundos_foco),
          materiaisLidos: linha.materiais_lidos ?? [],
          checklist: linha.checklist ?? {},
          anotacao: linha.anotacao ?? "",
          iniciadoEm: linha.iniciado_em,
        }
      : null;

  return (
    <SessaoGuiada
      bloco={{
        id: bloco.id,
        semana: bloco.semana,
        disciplina: bloco.disciplina,
        objetivo: bloco.objetivo,
        horas: Number(bloco.horas),
        anotacao: bloco.anotacao ?? "",
      }}
      materiais={materiais}
      questoes={questoes}
      minutosIniciais={minutos}
      metas={metas}
      sessaoInicial={sessaoInicial}
      outraSessaoItemId={
        linha && linha.roadmap_item_id !== bloco.id ? linha.roadmap_item_id : null
      }
    />
  );
}
