import { NextResponse } from "next/server";
import { minutosDaSessao, type ModoDaSessao } from "@/lib/sessao-estudo";
import { supabaseServidor, usuarioAtual } from "@/lib/supabase/servidor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function modoValido(valor: unknown): ModoDaSessao {
  return valor === "continuo" ? "continuo" : "pomodoro";
}

function textos(valor: unknown, limite = 20) {
  return Array.isArray(valor)
    ? [...new Set(valor.map(String).filter(Boolean))].slice(0, limite)
    : [];
}

function uuids(valor: unknown) {
  return textos(valor).filter((item) => UUID.test(item));
}

function texto(valor: unknown, limite = 4000) {
  return String(valor ?? "").trim().slice(0, limite);
}

function checklist(valor: unknown) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  return Object.fromEntries(
    Object.entries(valor as Record<string, unknown>)
      .slice(0, 30)
      .map(([chave, marcado]) => [chave.slice(0, 80), Boolean(marcado)]),
  );
}

export async function POST(request: Request) {
  const supabase = await supabaseServidor();
  // Sessão conferida no JWT, sem ida ao servidor de Auth (ver `usuarioAtual`).
  const user = await usuarioAtual();
  if (!user) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  if (corpo.acao === "iniciar") {
    const itemId = String(corpo.itemId ?? "");
    if (!UUID.test(itemId)) {
      return NextResponse.json({ erro: "Bloco inválido." }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("iniciar_sessao_estudo", {
      p_roadmap_item_id: itemId,
      p_minutos: minutosDaSessao(corpo.minutos),
      p_modo: modoValido(corpo.modo),
      p_questoes: uuids(corpo.questoes),
      p_materiais: textos(corpo.materiais),
    });
    if (error) {
      const outraAberta = error.code === "23505";
      console.error("Falha ao iniciar sessão guiada:", error);
      return NextResponse.json(
        {
          erro: outraAberta
            ? "Você já tem outra sessão em andamento. Encerre-a antes de começar este bloco."
            : "Não consegui iniciar a sessão.",
        },
        { status: outraAberta ? 409 : 500 },
      );
    }
    return NextResponse.json({ sessaoId: data });
  }

  const sessaoId = String(corpo.sessaoId ?? "");
  if (!UUID.test(sessaoId)) {
    return NextResponse.json({ erro: "Sessão inválida." }, { status: 400 });
  }
  const comuns = {
    p_sessao_id: sessaoId,
    p_segundos: Math.min(43200, Math.max(0, Math.round(Number(corpo.segundos) || 0))),
    p_modo: modoValido(corpo.modo),
    p_questoes: uuids(corpo.questoes),
    p_materiais_lidos: textos(corpo.materiaisLidos),
    p_checklist: checklist(corpo.checklist),
    p_anotacao: texto(corpo.anotacao),
  };

  if (corpo.acao === "salvar") {
    const { error } = await supabase.rpc("salvar_sessao_estudo", comuns);
    if (error) {
      console.error("Falha ao salvar sessão guiada:", error);
      return NextResponse.json(
        { erro: "Não consegui salvar o andamento." },
        { status: 500 },
      );
    }
    return NextResponse.json({ salvo: true });
  }

  if (corpo.acao === "encerrar") {
    const { data, error } = await supabase.rpc("encerrar_sessao_estudo", {
      ...comuns,
      p_resumo: texto(corpo.resumo),
      p_pendencias: texto(corpo.pendencias),
      p_concluir_bloco: Boolean(corpo.concluirBloco),
    });
    if (error) {
      console.error("Falha ao encerrar sessão guiada:", error);
      return NextResponse.json(
        { erro: "Não consegui encerrar a sessão." },
        { status: 500 },
      );
    }
    const linha = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      resultado: linha
        ? {
            segundosFoco: Number(linha.segundos_foco),
            questoesRespondidas: Number(linha.questoes_respondidas),
            acertos: Number(linha.acertos),
            materiaisLidos: Number(linha.materiais_lidos),
            blocoConcluido: Boolean(linha.bloco_concluido),
          }
        : null,
    });
  }

  return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
}
