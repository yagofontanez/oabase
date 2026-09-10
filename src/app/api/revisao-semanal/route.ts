import { NextResponse } from "next/server";
import { inicioDaSemana } from "@/lib/calendario";
import type { AcaoDaRevisao } from "@/lib/revisao-semanal";
import { supabaseServidor } from "@/lib/supabase/servidor";

const ACOES: AcaoDaRevisao[] = [
  "reagendar_pendencias",
  "reduzir_carga",
  "priorizar_revisoes",
  "praticar_questoes",
  "retomar_materia",
  "manter_ritmo",
];

function dataValida(valor: unknown) {
  const data = String(valor ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(data) && inicioDaSemana(data) === data
    ? data
    : null;
}

function texto(valor: unknown, limite: number) {
  return String(valor ?? "").trim().slice(0, limite);
}

export async function POST(request: Request) {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  const inicio = dataValida(corpo.inicio);
  if (!inicio) {
    return NextResponse.json({ erro: "Semana inválida." }, { status: 400 });
  }
  const acoes = Array.isArray(corpo.acoes)
    ? [...new Set(corpo.acoes.map(String))].filter(
        (acao): acao is AcaoDaRevisao => ACOES.includes(acao as AcaoDaRevisao),
      )
    : [];

  const { data, error } = await supabase.rpc("concluir_revisao_semanal", {
    p_inicio: inicio,
    p_reflexao: texto(corpo.reflexao, 4000),
    p_compromisso: texto(corpo.compromisso, 1000),
    p_acoes: acoes,
  });
  if (error) {
    console.error("Falha ao concluir revisão semanal:", error);
    return NextResponse.json(
      { erro: "Não consegui salvar o fechamento da semana." },
      { status: 500 },
    );
  }
  return NextResponse.json({ revisaoId: data });
}
