import { NextResponse } from "next/server";
import { supabaseServidor, usuarioAtual } from "@/lib/supabase/servidor";
import { diasAte, getDisciplinas, getProximoExame } from "@/lib/content/queries";
import { formatarData } from "@/lib/format";
import {
  ErroDeLimite,
  gerarPlano,
  type ContextoSalvoDoPlano,
  type Mensagem,
  type ModoDoPlano,
  type Plano,
} from "@/lib/ia/plano";
import { blocosDoPlano } from "@/lib/roadmap";

/**
 * Gera ou ajusta o plano de estudos.
 *
 * A chamada ao modelo acontece aqui, no servidor, porque a chave da Groq não
 * pode chegar ao navegador. O contexto é montado a partir do banco — o cliente
 * envia só o pedido em texto, nunca a lista de disciplinas nem os prazos:
 * quem manda os dados é o servidor, senão bastaria forjar o corpo para o
 * modelo planejar em cima de mentira.
 */
export async function POST(request: Request) {
  const supabase = await supabaseServidor();
  // Sessão conferida no JWT, sem ida ao servidor de Auth (ver `usuarioAtual`).
  const user = await usuarioAtual();
  if (!user) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  let pedido = "";
  let modo: ModoDoPlano = "oab";
  let disciplinasPedidas: string[] = [];
  let prazoLivre: string | null = null;
  try {
    const corpo = (await request.json()) as {
      mensagem?: unknown;
      modo?: unknown;
      disciplinas?: unknown;
      prazo?: unknown;
    };
    pedido = String(corpo.mensagem ?? "").trim().slice(0, 1200);
    modo = corpo.modo === "livre" ? "livre" : "oab";
    disciplinasPedidas = Array.isArray(corpo.disciplinas)
      ? corpo.disciplinas.map(String).slice(0, 18)
      : [];
    const prazo = String(corpo.prazo ?? "");
    prazoLivre = /^\d{4}-\d{2}-\d{2}$/.test(prazo) ? prazo : null;
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  if (!pedido) {
    return NextResponse.json(
      { erro: "Escreva o que você precisa antes de enviar." },
      { status: 400 },
    );
  }

  const { data: registro } = await supabase
    .from("planos_estudo")
    .select("plano, conversa, atualizado_em, versao_roadmap, contexto")
    .maybeSingle();

  // Freio simples contra envio repetido: o modelo leva alguns segundos e não
  // há motivo para duas gerações simultâneas da mesma pessoa.
  if (registro?.atualizado_em) {
    const desde = Date.now() - new Date(registro.atualizado_em).getTime();
    if (desde < 3000) {
      return NextResponse.json(
        { erro: "Espere alguns segundos antes de pedir de novo." },
        { status: 429 },
      );
    }
  }

  const conversa: Mensagem[] = Array.isArray(registro?.conversa)
    ? (registro.conversa as Mensagem[])
    : [];
  const contextoAnterior = registro?.contexto as ContextoSalvoDoPlano | null;
  const planoAtual =
    contextoAnterior?.modo === modo
      ? (registro?.plano as Plano | null) ?? null
      : null;

  const agora = new Date();
  const desde14 = new Date(agora);
  desde14.setDate(desde14.getDate() - 14);

  const [proximo, disciplinas, focoRes] = await Promise.all([
    getProximoExame(),
    getDisciplinas(),
    supabase
      .from("sessoes_foco")
      .select("minutos, disciplinas(nome)")
    .gte("concluido_em", desde14.toISOString()),
  ]);
  const permitidas = new Set(disciplinas.map((d) => d.nome));
  const nomesSelecionados = [...new Set(disciplinasPedidas)].filter((nome) =>
    permitidas.has(nome),
  );
  if (modo === "livre" && nomesSelecionados.length === 0) {
    return NextResponse.json(
      { erro: "Escolha ao menos uma matéria para o plano livre." },
      { status: 400 },
    );
  }
  const disciplinasDoPlano =
    modo === "livre"
      ? disciplinas.filter((d) => nomesSelecionados.includes(d.nome))
      : disciplinas;
  const contextoSalvo: ContextoSalvoDoPlano = {
    modo,
    disciplinas: modo === "livre" ? nomesSelecionados : [],
    prazo: modo === "livre" ? prazoLivre : null,
  };

  type Linha = {
    minutos: number;
    disciplinas: { nome: string } | { nome: string }[] | null;
  };
  const porDisciplina = new Map<string, number>();
  let totalFoco = 0;
  for (const s of (focoRes.data ?? []) as unknown as Linha[]) {
    totalFoco += s.minutos;
    const rel = Array.isArray(s.disciplinas) ? s.disciplinas[0] : s.disciplinas;
    if (rel?.nome) {
      porDisciplina.set(rel.nome, (porDisciplina.get(rel.nome) ?? 0) + s.minutos);
    }
  }

  const proximaConversa: Mensagem[] = [
    ...conversa,
    { papel: "pessoa", texto: pedido },
  ];

  let plano: Plano;
  try {
    plano = await gerarPlano(
      {
        modo,
        edicao: proximo.edicao,
        dataDaProva: formatarData(proximo.data, {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
        diasRestantes:
          modo === "livre" && prazoLivre
            ? diasAte(prazoLivre)
            : modo === "livre"
              ? 42
              : diasAte(proximo.data),
        prazoLivre,
        disciplinas: disciplinasDoPlano.map((d) => ({
          nome: d.nome,
          mediaPorProva: d.mediaPorProva,
        })),
        focoPorDisciplina: [...porDisciplina.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([nome, minutos]) => ({ nome, minutos })),
        minutosUltimos14Dias: totalFoco,
      },
      proximaConversa,
      planoAtual,
    );
  } catch (erro) {
    console.error("Falha ao gerar plano:", erro);
    if (erro instanceof ErroDeLimite) {
      return NextResponse.json(
        {
          erro: "O serviço de IA atingiu o limite de uso. Tente de novo em um minuto.",
        },
        { status: 429 },
      );
    }
    return NextResponse.json(
      {
        erro:
          "Não consegui montar o plano agora. Tente de novo em instantes — se persistir, reescreva o pedido de outra forma.",
      },
      { status: 502 },
    );
  }

  proximaConversa.push({
    papel: "assistente",
    texto: plano.diagnostico,
  });

  // RLS garante que a linha gravada é a da própria sessão.
  const versaoRoadmap = (registro?.versao_roadmap ?? 0) + 1;
  const { error } = await supabase.from("planos_estudo").upsert(
    {
      user_id: user.id,
      plano,
      contexto: contextoSalvo,
      versao_roadmap: versaoRoadmap,
      // Guarda um histórico curto: o ajuste depende do plano atual mais do
      // pedido recente, não da conversa inteira.
      conversa: proximaConversa.slice(-20),
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("Falha ao gravar plano:", error);
    return NextResponse.json(
      { erro: "O plano foi montado, mas não consegui salvar. Tente de novo." },
      { status: 500 },
    );
  }

  // Cada geração inaugura uma rota nova. Não reutilizamos linhas de uma
  // versão anterior: objetivos e ordem podem ter mudado, mas o histórico
  // antigo continua preservado no banco para nunca reescrever progresso.
  const itens = blocosDoPlano(plano).map((bloco) => ({
    user_id: user.id,
    versao: versaoRoadmap,
    ...bloco,
  }));
  const { data: roadmap, error: erroRoadmap } = await supabase
    .from("roadmap_itens")
    // Duplo toque, reconexão e reenvio podem alcançar esta etapa com a mesma
    // versão. O roadmap é derivado do plano salvo: repetir a escrita precisa
    // ser seguro, não transformar um plano válido em erro para a pessoa.
    .upsert(itens, { onConflict: "user_id,versao,semana,ordem" })
    .select("id, semana, ordem, disciplina, objetivo, horas, estado");

  if (erroRoadmap) {
    console.error("Falha ao criar roadmap:", erroRoadmap);
    // O plano já foi gravado. Não o tratamos como fracasso total: a tela
    // oferece converter o cronograma em roadmap numa segunda tentativa.
    return NextResponse.json({
      plano,
      conversa: proximaConversa.slice(-20),
      roadmap: [],
      aviso: "O cronograma foi salvo. Crie o roadmap pelo painel à direita.",
    });
  }

  const { error: erroHistorico } = await supabase.rpc(
    "registrar_versao_roadmap",
    {
      p_versao: versaoRoadmap,
      p_origem: "ia",
      p_motivo: registro?.versao_roadmap
        ? `Ajuste solicitado na conversa: ${pedido}`.slice(0, 500)
        : `Plano inicial criado por conversa: ${pedido}`.slice(0, 500),
      p_diagnostico: plano.diagnostico,
      p_plano: plano,
      p_contexto: contextoSalvo,
      p_versao_anterior: registro?.versao_roadmap || null,
    },
  );
  if (erroHistorico) {
    // O trigger já garantiu a versão genérica; esta chamada acrescenta a
    // explicação humana e a fotografia completa sem derrubar o plano salvo.
    console.error("Falha ao detalhar histórico do roadmap:", erroHistorico);
  }

  return NextResponse.json({
    plano,
    conversa: proximaConversa.slice(-20),
    roadmap: roadmap ?? [],
  });
}

/**
 * Apaga o plano e a conversa.
 *
 * Recomeçar do zero é diferente de pedir um ajuste: quando a vida da pessoa
 * muda de fato — trocou de emprego, adiou a inscrição — o histórico de
 * pedidos anteriores atrapalha em vez de ajudar, porque o modelo continua
 * ajustando um cronograma feito para outra realidade.
 *
 * O `delete` não filtra por dono aqui: quem filtra é a RLS de
 * `planos_estudo`, que só deixa a sessão enxergar a própria linha.
 */
export async function DELETE() {
  const supabase = await supabaseServidor();
  // Sessão conferida no JWT, sem ida ao servidor de Auth (ver `usuarioAtual`).
  const user = await usuarioAtual();
  if (!user) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  const { error } = await supabase
    .from("planos_estudo")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("Falha ao apagar plano:", error);
    return NextResponse.json(
      { erro: "Não consegui apagar o plano agora. Tente de novo." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
