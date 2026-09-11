import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { Plano } from "@/lib/ia/plano";
import { blocosDoPlano } from "@/lib/roadmap";

/** Cria o roadmap para planos montados antes desta funcionalidade existir. */
export async function POST() {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  const { data: registro, error: erroPlano } = await supabase
    .from("planos_estudo")
    .select("plano, versao_roadmap")
    .maybeSingle();
  if (erroPlano || !registro || !registro.plano) {
    return NextResponse.json(
      { erro: "Monte um cronograma antes de criar o roadmap." },
      { status: 400 },
    );
  }
  const plano = registro.plano as Plano;

  const versao = registro.versao_roadmap || 1;
  if (registro.versao_roadmap === 0) {
    const { error } = await supabase
      .from("planos_estudo")
      .update({ versao_roadmap: versao })
      .eq("user_id", user.id);
    if (error) {
      return NextResponse.json(
        { erro: "Não consegui preparar o roadmap." },
        { status: 500 },
      );
    }
  }

  const { data: existentes, error: erroExistentes } = await supabase
    .from("roadmap_itens")
    .select("id, semana, ordem, disciplina, objetivo, horas, estado")
    .eq("versao", versao)
    .order("semana")
    .order("ordem");
  if (erroExistentes) {
    return NextResponse.json(
      { erro: "Não consegui ler o roadmap." },
      { status: 500 },
    );
  }
  if (existentes.length > 0) return NextResponse.json({ roadmap: existentes });

  const { data: roadmap, error } = await supabase
    .from("roadmap_itens")
    .upsert(
      blocosDoPlano(plano).map((bloco) => ({
        user_id: user.id,
        versao,
        ...bloco,
      })),
      { onConflict: "user_id,versao,semana,ordem" },
    )
    .select("id, semana, ordem, disciplina, objetivo, horas, estado");
  if (error) {
    return NextResponse.json(
      { erro: "Não consegui criar o roadmap." },
      { status: 500 },
    );
  }

  const { error: erroHistorico } = await supabase.rpc(
    "registrar_versao_roadmap",
    {
      p_versao: versao,
      p_origem: "manual",
      p_motivo: "Roadmap interativo criado a partir do plano existente.",
      p_diagnostico: plano.diagnostico,
      p_plano: plano,
      p_contexto: null,
      p_versao_anterior: versao > 1 ? versao - 1 : null,
    },
  );
  if (erroHistorico) {
    console.error("Falha ao detalhar histórico do roadmap:", erroHistorico);
  }

  return NextResponse.json({ roadmap: roadmap ?? [] });
}
