import { NextResponse } from "next/server";
import { memoriasDosArtigos } from "@/lib/caderno-lei-seca-servidor";
import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Registra a resposta de uma questão.
 *
 * O cliente manda a alternativa escolhida e nada mais. Quem compara com o
 * gabarito, grava em `respostas` e reagenda a revisão é a função
 * `registrar_resposta`, no banco — o gabarito nunca é enviado ao navegador
 * antes de a pessoa responder, e `acertou` nunca vem de fora.
 *
 * O corolário disso é que esta rota é fina de propósito: qualquer regra que
 * ela aplicasse por conta própria seria uma regra contornável.
 */
export async function POST(request: Request) {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  let questaoId = "";
  let alternativa = "";
  let tempoMs: number | null = null;
  try {
    const corpo = (await request.json()) as Record<string, unknown>;
    questaoId = String(corpo.questaoId ?? "");
    alternativa = String(corpo.alternativa ?? "").toUpperCase();
    const bruto = Number(corpo.tempoMs);
    // Tempo é telemetria de estudo, não auditoria: se vier absurdo, some.
    tempoMs =
      Number.isFinite(bruto) && bruto > 0 && bruto < 3_600_000
        ? Math.round(bruto)
        : null;
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  if (!questaoId || !["A", "B", "C", "D"].includes(alternativa)) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("registrar_resposta", {
    p_questao_id: questaoId,
    p_alternativa: alternativa,
    p_tempo_ms: tempoMs,
  });

  if (error) {
    console.error("Falha ao registrar resposta:", error);
    // 42501 é a checagem de assinatura dentro da função. Vale uma mensagem
    // própria: "erro ao salvar" mandaria a pessoa tentar de novo para sempre.
    if (error.code === "42501") {
      return NextResponse.json(
        { erro: "Seu plano não está ativo." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { erro: "Não consegui registrar a resposta. Tente de novo." },
      { status: 500 },
    );
  }

  const linha = (Array.isArray(data) ? data[0] : data) as
    | { acertou: boolean; gabarito: string; comentario: string[] }
    | undefined;

  if (!linha) {
    return NextResponse.json(
      { erro: "Não consegui registrar a resposta. Tente de novo." },
      { status: 500 },
    );
  }

  /* Os dispositivos cobrados. Enquanto o comentário da questão não existe,
     é o que dá à pessoa para onde ir depois de errar — e o link cai numa
     página de legislação que já é conteúdo aberto e comentado.

     `artigos_da_questao` devolve vínculo verificável: o texto da questão cita
     aquele artigo. Quando não há citação — a esmagadora maioria dos casos,
     porque a FGV narra o caso sem nomear o dispositivo — a tela cai para
     `artigos_proximos_da_questao`, que é semelhança de texto e é rotulada
     como sugestão. As duas coisas nunca se misturam no mesmo rótulo. */
  const { data: vinculados } = await supabase.rpc("artigos_da_questao", {
    p_questao_id: questaoId,
  });

  type LinhaArtigo = {
    lei_slug: string;
    lei_sigla: string;
    artigo_slug: string;
    numero: string;
    caput: string;
    tem_comentario: boolean;
  };

  let artigos = ((vinculados ?? []) as LinhaArtigo[]).map((a) => ({
    href: `/legislacao/${a.lei_slug}/${a.artigo_slug}`,
    rotulo: `Art. ${a.numero} ${a.lei_sigla}`,
    caput: a.caput.slice(0, 180),
    comentado: a.tem_comentario,
  }));

  let sugestoes: typeof artigos = [];
  if (artigos.length === 0) {
    const { data: proximos } = await supabase.rpc(
      "artigos_proximos_da_questao",
      { p_questao_id: questaoId, p_limite: 3 },
    );
    sugestoes = ((proximos ?? []) as LinhaArtigo[]).map((a) => ({
      href: `/legislacao/${a.lei_slug}/${a.artigo_slug}`,
      rotulo: `Art. ${a.numero} ${a.lei_sigla}`,
      caput: a.caput.slice(0, 180),
      comentado: a.tem_comentario,
    }));
  }

  // Uma regra marcada durante outra leitura precisa reaparecer quando a
  // questão trouxer o mesmo dispositivo. O vínculo continua vindo do acervo;
  // nota e destaque são apenas a memória privada de quem está estudando.
  const candidatos = artigos.length > 0 ? artigos : sugestoes;
  const referencias = candidatos.map((artigo) => {
    const partes = artigo.href.split("/");
    return { leiSlug: partes[2] ?? "", artigoSlug: partes[3] ?? "" };
  });
  const memorias = await memoriasDosArtigos(referencias);
  const comMemoria = candidatos.map((artigo, indice) => {
    const referencia = referencias[indice];
    const memoria = memorias[`${referencia.leiSlug}/${referencia.artigoSlug}`];
    return {
      ...artigo,
      nota: memoria?.nota ?? "",
      destaques: memoria?.destaques ?? [],
    };
  });
  if (artigos.length > 0) artigos = comMemoria;
  else sugestoes = comMemoria;

  /* Questões parecidas. A pergunta que vem logo depois de errar é "onde mais
     isto cai?", e três questões do mesmo assunto respondem melhor do que
     qualquer texto genérico. O motivo vem junto porque "mesmo dispositivo" e
     "texto semelhante" são graus de certeza diferentes. */
  const { data: proximas } = await supabase.rpc("questoes_parecidas", {
    p_questao_id: questaoId,
    p_limite: 3,
  });

  type LinhaParecida = {
    id: string;
    numero: number;
    edicao: number;
    exame_slug: string;
    disciplina_nome: string | null;
    resumo: string;
    motivo: string;
  };

  const parecidas = ((proximas ?? []) as LinhaParecida[]).map((q) => ({
    edicao: q.edicao,
    numero: q.numero,
    exameSlug: q.exame_slug,
    disciplina: q.disciplina_nome,
    resumo: q.resumo,
    motivo: q.motivo,
  }));

  /* Dificuldade medida. Vem depois do registro de propósito: a resposta que
     acabou de entrar já conta na estatística, e é assim que a base cresce.
     Abaixo do piso de respondentes a função devolve nada, e a tela cala. */
  const { data: dificuldadeBruta } = await supabase.rpc(
    "dificuldade_da_questao",
    { p_questao_id: questaoId },
  );
  const dif = (Array.isArray(dificuldadeBruta)
    ? dificuldadeBruta[0]
    : dificuldadeBruta) as
    | { respondentes: number; taxa_acerto: number }
    | undefined;

  return NextResponse.json({
    acertou: linha.acertou,
    gabarito: linha.gabarito,
    comentario: linha.comentario ?? [],
    artigos,
    sugestoes,
    parecidas,
    dificuldade: dif
      ? { respondentes: dif.respondentes, taxaAcerto: dif.taxa_acerto }
      : null,
  });
}
