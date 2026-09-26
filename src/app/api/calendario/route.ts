import { NextResponse } from "next/server";
import {
  diaIndisponivel,
  distribuirRoadmapNoCalendario,
  hojeEmBrasilia,
  itensParaReagendar,
  type ItemDoCalendario,
  type PreferenciasDoCalendario,
} from "@/lib/calendario";
import type { EstadoDoRoadmap } from "@/lib/roadmap";
import { supabaseServidor, usuarioAtual } from "@/lib/supabase/servidor";

type LinhaRoadmap = {
  id: string;
  semana: number;
  ordem: number;
  disciplina: string;
  objetivo: string;
  horas: number | string;
  estado: EstadoDoRoadmap;
  data_planejada: string | null;
  horario_planejado: string | null;
  concluido_em: string | null;
};

const PADRAO: PreferenciasDoCalendario = {
  diasIndisponiveis: [],
  datasIndisponiveis: [],
  horarioPreferido: "19:00",
  lembreteEmail: false,
};

function horarioValido(valor: unknown) {
  const horario = String(valor ?? "");
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(horario) ? horario : null;
}

function dataValida(valor: unknown) {
  const data = String(valor ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null;
}

function lerPreferencias(linha: Record<string, unknown> | null) {
  if (!linha) return PADRAO;
  return {
    diasIndisponiveis: Array.isArray(linha.dias_indisponiveis)
      ? linha.dias_indisponiveis.map(Number)
      : [],
    datasIndisponiveis: Array.isArray(linha.datas_indisponiveis)
      ? linha.datas_indisponiveis.map(String)
      : [],
    horarioPreferido: String(linha.horario_preferido ?? "19:00").slice(0, 5),
    lembreteEmail: Boolean(linha.lembrete_email),
  } satisfies PreferenciasDoCalendario;
}

async function contextoDoCalendario() {
  const supabase = await supabaseServidor();
  // Sessão conferida no JWT, sem ida ao servidor de Auth (ver `usuarioAtual`).
  const user = await usuarioAtual();
  if (!user) return { erro: "Sessão expirada.", status: 401 } as const;

  const [{ data: plano }, { data: preferencias }] = await Promise.all([
    supabase.from("planos_estudo").select("versao_roadmap").maybeSingle(),
    supabase.from("calendario_preferencias").select("*").maybeSingle(),
  ]);
  if (!plano?.versao_roadmap) {
    return {
      erro: "Crie um roadmap antes de montar o calendário.",
      status: 400,
    } as const;
  }
  return {
    supabase,
    user,
    versao: plano.versao_roadmap as number,
    preferencias: lerPreferencias(preferencias as Record<string, unknown> | null),
  };
}

export async function PATCH(request: Request) {
  const contexto = await contextoDoCalendario();
  if ("erro" in contexto) {
    return NextResponse.json({ erro: contexto.erro }, { status: contexto.status });
  }
  const { supabase, user, versao } = contexto;
  let corpo: Record<string, unknown>;
  try {
    corpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  if (corpo.acao === "preferencias") {
    const dias = Array.isArray(corpo.diasIndisponiveis)
      ? [...new Set(corpo.diasIndisponiveis.map(Number))]
          .filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6)
          .sort()
      : [];
    const datas = Array.isArray(corpo.datasIndisponiveis)
      ? [...new Set(corpo.datasIndisponiveis.map(dataValida).filter(Boolean))]
          .sort()
          .slice(0, 90)
      : [];
    const horario = horarioValido(corpo.horarioPreferido);
    if (dias.length >= 7 || !horario) {
      return NextResponse.json(
        { erro: "Mantenha ao menos um dia disponível e informe um horário válido." },
        { status: 400 },
      );
    }
    const { error } = await supabase.from("calendario_preferencias").upsert(
      {
        user_id: user.id,
        dias_indisponiveis: dias,
        datas_indisponiveis: datas,
        horario_preferido: horario,
        lembrete_email: Boolean(corpo.lembreteEmail),
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) {
      console.error("Falha ao salvar preferências do calendário:", error);
      return NextResponse.json(
        { erro: "Não consegui salvar as preferências." },
        { status: 500 },
      );
    }
    return NextResponse.json({
      preferencias: {
        diasIndisponiveis: dias,
        datasIndisponiveis: datas,
        horarioPreferido: horario,
        lembreteEmail: Boolean(corpo.lembreteEmail),
      },
    });
  }

  if (corpo.acao === "mover") {
    const itemId = String(corpo.itemId ?? "");
    const data = corpo.data === null ? null : dataValida(corpo.data);
    const horario = horarioValido(corpo.horario) ?? contexto.preferencias.horarioPreferido;
    if (!/^[0-9a-f-]{36}$/i.test(itemId) || (corpo.data !== null && !data)) {
      return NextResponse.json({ erro: "Destino inválido." }, { status: 400 });
    }
    if (data && diaIndisponivel(data, contexto.preferencias)) {
      return NextResponse.json(
        { erro: "Esse dia está marcado como indisponível." },
        { status: 400 },
      );
    }
    const { data: alterados, error } = await supabase.rpc(
      "agendar_blocos_do_roadmap",
      {
        p_versao: versao,
        p_agendamentos: [
          {
            id: itemId,
            data_planejada: data,
            horario_planejado: data ? horario : null,
          },
        ],
      },
    );
    if (error || Number(alterados) !== 1) {
      return NextResponse.json(
        { erro: "Não consegui mover esse bloco." },
        { status: 500 },
      );
    }
    return NextResponse.json({ itemId, data, horario: data ? horario : null });
  }

  if (corpo.acao !== "distribuir" && corpo.acao !== "reagendar") {
    return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
  }

  const { data: linhas, error: erroItens } = await supabase
    .from("roadmap_itens")
    .select(
      "id, semana, ordem, disciplina, objetivo, horas, estado, data_planejada, horario_planejado, concluido_em",
    )
    .eq("versao", versao)
    .order("semana")
    .order("ordem");
  if (erroItens || !linhas) {
    return NextResponse.json(
      { erro: "Não consegui ler o roadmap." },
      { status: 500 },
    );
  }
  const itens: ItemDoCalendario[] = (linhas as unknown as LinhaRoadmap[]).map(
    (linha) => ({
      id: linha.id,
      semana: linha.semana,
      ordem: linha.ordem,
      disciplina: linha.disciplina,
      objetivo: linha.objetivo,
      horas: Number(linha.horas),
      estado: linha.estado,
      dataPlanejada: linha.data_planejada,
      horarioPlanejado: linha.horario_planejado?.slice(0, 5) ?? null,
      concluidoEm: linha.concluido_em,
    }),
  );
  const hoje = hojeEmBrasilia();
  const somente =
    corpo.acao === "reagendar" ? itensParaReagendar(itens, hoje) : undefined;
  if (somente?.size === 0) {
    return NextResponse.json({ atualizacoes: [], mensagem: "Não há pendências vencidas." });
  }
  const atualizacoes = distribuirRoadmapNoCalendario({
    itens,
    preferencias: contexto.preferencias,
    inicio: hoje,
    somente,
  });
  const { data: alterados, error: erroAgenda } = await supabase.rpc(
    "agendar_blocos_do_roadmap",
    {
      p_versao: versao,
      p_agendamentos: atualizacoes.map((item) => ({
        id: item.id,
        data_planejada: item.dataPlanejada,
        horario_planejado: item.horarioPlanejado,
      })),
    },
  );
  if (erroAgenda || Number(alterados) !== atualizacoes.length) {
    console.error("Falha ao distribuir calendário:", erroAgenda);
    return NextResponse.json(
      { erro: "Não consegui salvar a nova distribuição." },
      { status: 500 },
    );
  }
  return NextResponse.json({ atualizacoes });
}
