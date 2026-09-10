import type { Metadata } from "next";
import { Roadmap, type LeituraDoRoadmap } from "@/components/app/roadmap";
import { RoadmapVazio } from "@/components/app/roadmap-vazio";
import type { QuestaoDaFila } from "@/components/app/resolvedor";
import {
  getArtigosDaDisciplina,
  getDisciplinas,
  getLeis,
  getProximoExame,
} from "@/lib/content/queries";
import type { ContextoSalvoDoPlano, Plano } from "@/lib/ia/plano";
import {
  diagnosticarReplanejamento,
  type ItemParaReplanejar,
} from "@/lib/replanejamento";
import type { EstadoDoRoadmap, ItemRoadmap } from "@/lib/roadmap";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Roadmap",
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

type LinhaRoadmap = ItemRoadmap & {
  horas: number;
  estado: EstadoDoRoadmap;
  iniciado_em: string | null;
  concluido_em: string | null;
};

export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const { item: itemPedido } = await searchParams;
  const supabase = await supabaseServidor();
  const [registroRes, disciplinas, leis, proximoExame] = await Promise.all([
    supabase
      .from("planos_estudo")
      .select("plano, contexto, versao_roadmap, atualizado_em")
      .maybeSingle(),
    getDisciplinas(),
    getLeis(),
    getProximoExame(),
  ]);
  const registro = registroRes.data;
  if (!registro?.plano) return <RoadmapVazio temPlano={false} />;

  const [roadmapRes, focoRes] = registro.versao_roadmap
    ? await Promise.all([
        supabase
          .from("roadmap_itens")
          .select(
            "id, semana, ordem, disciplina, objetivo, horas, estado, anotacao, iniciado_em, concluido_em",
          )
          .eq("versao", registro.versao_roadmap)
          .order("semana")
          .order("ordem"),
        supabase
          .from("sessoes_foco")
          .select("minutos")
          .gte("concluido_em", registro.atualizado_em),
      ])
    : [{ data: [] }, { data: [] }];
  const linhas = (roadmapRes.data ?? []) as unknown as LinhaRoadmap[];
  const itens = linhas.map((linha) => ({
    id: linha.id,
    semana: linha.semana,
    ordem: linha.ordem,
    disciplina: linha.disciplina,
    objetivo: linha.objetivo,
    horas: Number(linha.horas),
    estado: linha.estado,
    anotacao: linha.anotacao,
  }));
  if (itens.length === 0) return <RoadmapVazio temPlano />;

  const ativo =
    itens.find((item) => item.id === itemPedido) ??
    itens.find((item) => item.estado !== "concluido") ??
    itens[0];
  const disciplina = disciplinas.find((item) => item.nome === ativo.disciplina);
  const plano = registro.plano as Plano;
  const contexto = registro.contexto as ContextoSalvoDoPlano | null;
  const prazo = contexto?.modo === "livre" ? contexto.prazo : proximoExame.data;
  const minutosDeFocoRegistrados = (focoRes.data ?? []).reduce(
    (total, sessao) => total + Number(sessao.minutos),
    0,
  );
  const itensParaReplanejar: ItemParaReplanejar[] = linhas.map((linha) => ({
    id: linha.id,
    semana: linha.semana,
    ordem: linha.ordem,
    disciplina: linha.disciplina,
    objetivo: linha.objetivo,
    horas: Number(linha.horas),
    estado: linha.estado,
    anotacao: linha.anotacao,
    iniciadoEm: linha.iniciado_em,
    concluidoEm: linha.concluido_em,
  }));
  const diagnosticoReplanejamento = diagnosticarReplanejamento({
    itens: itensParaReplanejar,
    plano,
    atualizadoEm: registro.atualizado_em,
    minutosDeFocoRegistrados,
    prazo,
  });
  const siglas = new Map(leis.map((lei) => [lei.slug, lei.sigla]));
  const artigosDaDisciplina = disciplina
    ? await getArtigosDaDisciplina(disciplina.slug, 3)
    : [];
  const leituras: LeituraDoRoadmap[] = disciplina
    ? artigosDaDisciplina
        .sort((a, b) => b.incidencia - a.incidencia)
        .slice(0, 3)
        .map((artigo) => ({
          href: `/legislacao/${artigo.leiSlug}/${artigo.slug}`,
          rotulo: `Art. ${artigo.numero} ${siglas.get(artigo.leiSlug) ?? ""}`.trim(),
          caput: artigo.caput,
          comentario: artigo.comentario,
        }))
    : [];

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
  const focos = Object.fromEntries(
    plano.semanas.map((semana) => [semana.numero, semana.foco]),
  );

  return (
    <Roadmap
      key={ativo.id}
      itensIniciais={itens}
      ativoId={ativo.id}
      focos={focos}
      leituras={leituras}
      questoes={questoes}
      disciplinaSlug={disciplina?.slug ?? null}
      diagnosticoReplanejamento={diagnosticoReplanejamento}
      versao={registro.versao_roadmap}
    />
  );
}
