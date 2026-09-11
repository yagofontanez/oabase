import { NextResponse } from "next/server";
import { getProximoExame } from "@/lib/content/queries";
import type {
  ContextoSalvoDoPlano,
  Mensagem,
  Plano,
} from "@/lib/ia/plano";
import {
  diagnosticarReplanejamento,
  montarPropostaDeReplanejamento,
  type ItemParaReplanejar,
} from "@/lib/replanejamento";
import type { EstadoDoRoadmap } from "@/lib/roadmap";
import { supabaseServidor } from "@/lib/supabase/servidor";

type LinhaRoadmap = {
  id: string;
  semana: number;
  ordem: number;
  disciplina: string;
  objetivo: string;
  horas: number | string;
  estado: EstadoDoRoadmap;
  anotacao: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
};

function paraItem(linha: LinhaRoadmap): ItemParaReplanejar {
  return {
    id: linha.id,
    semana: linha.semana,
    ordem: linha.ordem,
    disciplina: linha.disciplina,
    objetivo: linha.objetivo,
    horas: Number(linha.horas),
    estado: linha.estado,
    anotacao: linha.anotacao ?? "",
    iniciadoEm: linha.iniciado_em,
    concluidoEm: linha.concluido_em,
  };
}

function disponibilidadeValida(valor: unknown) {
  const horas = Number(valor);
  if (!Number.isFinite(horas) || horas < 1 || horas > 60) return null;
  return Math.round(horas * 2) / 2;
}

export async function POST(request: Request) {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  let acao: "simular" | "aplicar";
  let versaoInformada: number;
  let horasPorSemana: number | null;
  try {
    const corpo = (await request.json()) as Record<string, unknown>;
    acao = corpo.acao === "aplicar" ? "aplicar" : "simular";
    versaoInformada = Number(corpo.versao);
    horasPorSemana = disponibilidadeValida(corpo.horasPorSemana);
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  if (!Number.isInteger(versaoInformada) || versaoInformada < 1) {
    return NextResponse.json(
      { erro: "Atualize a página antes de replanejar." },
      { status: 409 },
    );
  }
  if (horasPorSemana === null) {
    return NextResponse.json(
      { erro: "Informe entre 1 e 60 horas por semana, em intervalos de meia hora." },
      { status: 400 },
    );
  }

  const { data: registro, error: erroPlano } = await supabase
    .from("planos_estudo")
    .select("plano, contexto, conversa, versao_roadmap, atualizado_em")
    .maybeSingle();
  if (erroPlano || !registro?.plano || !registro.versao_roadmap) {
    return NextResponse.json(
      { erro: "Não encontrei um roadmap ativo para replanejar." },
      { status: 400 },
    );
  }
  if (registro.versao_roadmap !== versaoInformada) {
    return NextResponse.json(
      { erro: "O roadmap mudou em outra tela. Atualize a página e tente novamente." },
      { status: 409 },
    );
  }

  const { data: linhas, error: erroRoadmap } = await supabase
    .from("roadmap_itens")
    .select(
      "id, semana, ordem, disciplina, objetivo, horas, estado, anotacao, iniciado_em, concluido_em",
    )
    .eq("versao", registro.versao_roadmap)
    .order("semana")
    .order("ordem");
  if (erroRoadmap || !linhas?.length) {
    return NextResponse.json(
      { erro: "Não consegui ler os blocos do roadmap." },
      { status: 500 },
    );
  }

  const planoAtual = registro.plano as Plano;
  const contexto = (registro.contexto as ContextoSalvoDoPlano | null) ?? {
    modo: "oab",
    disciplinas: [],
    prazo: null,
  };
  const proximoExame = contexto.modo === "oab" ? await getProximoExame() : null;
  const prazo = contexto.modo === "oab" ? proximoExame?.data ?? null : contexto.prazo;
  const itens = (linhas as unknown as LinhaRoadmap[]).map(paraItem);

  let proposta;
  try {
    proposta = montarPropostaDeReplanejamento({
      itens,
      planoAtual,
      horasPorSemana,
      prazo,
    });
  } catch (erro) {
    return NextResponse.json(
      {
        erro:
          erro instanceof Error
            ? erro.message
            : "Não consegui redistribuir os blocos.",
      },
      { status: 400 },
    );
  }

  if (acao === "simular") {
    return NextResponse.json({ proposta: proposta.resumo });
  }

  const agora = new Date().toISOString();
  const novaVersao = registro.versao_roadmap + 1;
  const { data: novosItens, error: erroNovosItens } = await supabase
    .from("roadmap_itens")
    .upsert(
      proposta.itens.map((item) => ({
        user_id: user.id,
        versao: novaVersao,
        semana: item.semana,
        ordem: item.ordem,
        disciplina: item.disciplina,
        objetivo: item.objetivo,
        horas: item.horas,
        estado: item.estado,
        anotacao: item.anotacao,
        iniciado_em: item.iniciadoEm,
        concluido_em: item.concluidoEm,
        atualizado_em: agora,
      })),
      { onConflict: "user_id,versao,semana,ordem" },
    )
    .select("id, semana, ordem");
  if (erroNovosItens) {
    console.error("Falha ao gravar proposta de replanejamento:", erroNovosItens);
    return NextResponse.json(
      { erro: "Não consegui criar a nova versão do roadmap." },
      { status: 500 },
    );
  }

  const idsNovos = new Map(
    (novosItens ?? []).map((item) => [
      `${item.semana}:${item.ordem}`,
      item.id,
    ]),
  );
  const mapeamentos = proposta.itens.flatMap((item) => {
    const destinoId = idsNovos.get(`${item.semana}:${item.ordem}`);
    return item.origemItemId && destinoId
      ? [{ origem_id: item.origemItemId, destino_id: destinoId }]
      : [];
  });
  const { error: erroMetas } = await supabase.rpc("copiar_metas_roadmap", {
    p_mapeamentos: mapeamentos,
  });
  if (erroMetas) {
    console.error("Falha ao preservar metas no replanejamento:", erroMetas);
    return NextResponse.json(
      { erro: "Não consegui preservar as metas na nova versão do roadmap." },
      { status: 500 },
    );
  }

  const diagnostico = diagnosticarReplanejamento({
    itens,
    plano: planoAtual,
    atualizadoEm: registro.atualizado_em,
    minutosDeFocoRegistrados: 0,
    prazo,
  });
  const mudouDisponibilidade = horasPorSemana !== planoAtual.horasPorSemana;
  const motivo = diagnostico.atrasados
    ? `${diagnostico.atrasados} ${diagnostico.atrasados === 1 ? "bloco atrasado" : "blocos atrasados"}`
    : mudouDisponibilidade
      ? "mudança de disponibilidade semanal"
      : "redistribuição solicitada pelo aluno";
  const conversaAnterior = Array.isArray(registro.conversa)
    ? (registro.conversa as Mensagem[])
    : [];
  const registroDoReplanejamento: Mensagem[] = [
    {
      papel: "pessoa",
      texto: `Replanejei meu roadmap por ${motivo}, com ${horasPorSemana}h disponíveis por semana.`,
    },
    { papel: "assistente", texto: proposta.plano.diagnostico },
  ];
  const conversa: Mensagem[] = [
    ...conversaAnterior,
    ...registroDoReplanejamento,
  ].slice(-20);
  const proximoContexto: ContextoSalvoDoPlano = {
    ...contexto,
    ...(contexto.ementa
      ? {
          ementa: {
            ...contexto.ementa,
            horasPorSemana,
          },
        }
      : {}),
    ultimoReplanejamento: {
      realizadoEm: agora,
      versaoAnterior: registro.versao_roadmap,
      motivo,
      horasAnteriores: planoAtual.horasPorSemana,
      horasAtuais: horasPorSemana,
    },
  };
  const { data: atualizado, error: erroAtualizacao } = await supabase
    .from("planos_estudo")
    .update({
      plano: proposta.plano,
      contexto: proximoContexto,
      conversa,
      versao_roadmap: novaVersao,
      atualizado_em: agora,
    })
    .eq("user_id", user.id)
    .eq("versao_roadmap", registro.versao_roadmap)
    .select("versao_roadmap")
    .maybeSingle();
  if (erroAtualizacao || !atualizado) {
    console.error("Falha ao ativar replanejamento:", erroAtualizacao);
    return NextResponse.json(
      {
        erro:
          "O roadmap mudou enquanto você confirmava. Atualize a página e tente novamente.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    versao: novaVersao,
    proposta: proposta.resumo,
  });
}
