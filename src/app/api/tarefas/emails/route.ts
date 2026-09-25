import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  ajudaParaComecar,
  boasVindas,
  lembreteDoCalendario,
  planoAcabando,
  revisaoDoDia,
} from "@/lib/email/modelos";
import { enviar } from "@/lib/email/resend";
import { site } from "@/lib/site";
import { diasAte, getProximoExame } from "@/lib/content/queries";
import { planos } from "@/lib/planos";

/**
 * Tarefa diária de e-mail: ativação de conta, lembrete de revisão e aviso de
 * fim de plano.
 *
 * Chamada pela função agendada da Netlify
 * (netlify/functions/emails-diarios.mts), que envia
 * `Authorization: Bearer $CRON_SECRET`. Sem sessão, como o webhook — e a saída é a mesma: funções `security
 * definer` guardadas por um segredo próprio em `interno.segredos`. Segredo
 * separado do webhook de propósito: quem consegue disparar e-mail não deveria,
 * pelo mesmo vazamento, conseguir confirmar pagamento.
 *
 * **A marcação em `emails_enviados` acontece depois do envio bem-sucedido.**
 * Marcar antes evitaria duplicata ao custo de perder a mensagem em silêncio
 * quando o provedor falhasse — e um lembrete a mais incomoda menos do que um
 * aviso de fim de plano que nunca chegou. A chave de idempotência do Resend
 * cobre o intervalo entre uma coisa e outra.
 *
 * O envio é sequencial. Com o volume de hoje isso é irrelevante, e o limite
 * de requisições do Resend é por segundo — disparar tudo em paralelo seria
 * trocar um laço simples por 429 e retentativa.
 */

export const dynamic = "force-dynamic";

/**
 * Teto de envios por execução.
 *
 * Na Netlify a função síncrona tem alguns segundos de vida, não os 300 que a
 * Vercel dá — um lote grande estouraria o tempo e morreria no meio, deixando
 * parte das pessoas marcada como avisada e parte não. Com teto, o excedente
 * simplesmente entra na execução do dia seguinte.
 *
 * Com o volume atual isso nunca é alcançado; existe para o dia em que for.
 */
const TETO_POR_EXECUCAO = 80;

type Destinatario = {
  user_id: string;
  email: string;
  nome: string;
};

type ParaRevisar = Destinatario & { questoes: number };

type ParaAvisar = Destinatario & {
  plano: string;
  fim: string;
  dias_restantes: number;
  referencia: string;
};

type ParaLembrarCalendario = Destinatario & {
  blocos: number;
  minutos: number;
  disciplinas: string;
  horario: string;
};

type ParaAtivar = Destinatario & {
  etapa: "boas_vindas" | "como_comecar";
};

function clienteSemSessao() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function autorizado(request: Request) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const cabecalho = request.headers.get("authorization");
  return cabecalho === `Bearer ${esperado}`;
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const segredo = process.env.CRON_EMAIL_SEGREDO;
  if (!segredo) {
    console.error("CRON_EMAIL_SEGREDO não configurada.");
    return NextResponse.json({ erro: "não configurado" }, { status: 500 });
  }

  const supabase = clienteSemSessao();
  const proximo = await getProximoExame();
  const dias = diasAte(proximo.data);

  const relatorio = {
    ativacao: { enviados: 0, falhas: 0, pendentes: 0 },
    revisao: { enviados: 0, falhas: 0, pendentes: 0 },
    calendario: { enviados: 0, falhas: 0, pendentes: 0 },
    planoAcabando: { enviados: 0, falhas: 0, pendentes: 0 },
  };

  async function marcar(userId: string, tipo: string, referencia: string) {
    const { error } = await supabase.rpc("registrar_email", {
      p_segredo: segredo,
      p_user_id: userId,
      p_tipo: tipo,
      p_referencia: referencia,
    });
    if (error) console.error("Falha ao registrar envio:", error);
  }

  /* ---- Primeiros passos de uma conta nova ---- */
  const { data: ativar, error: erroAtivar } = await supabase.rpc(
    "destinatarios_ativacao",
    { p_segredo: segredo },
  );
  if (erroAtivar) {
    console.error("Falha ao listar ativações:", erroAtivar);
    return NextResponse.json({ erro: "falha" }, { status: 500 });
  }

  // A sequência é deliberadamente menor que os outros lotes: é uma mensagem
  // opcional para contas novas, não um aviso operacional que precise alcançar
  // toda a base no mesmo minuto.
  const filaAtivacao = ((ativar ?? []) as ParaAtivar[]).slice(0, 20);
  for (const pessoa of filaAtivacao) {
    const modelo =
      pessoa.etapa === "boas_vindas"
        ? boasVindas({ nome: pessoa.nome, site: site.url })
        : ajudaParaComecar({ nome: pessoa.nome, site: site.url });
    const envio = await enviar({
      para: pessoa.email,
      assunto: modelo.assunto,
      html: modelo.html,
      texto: modelo.texto,
      chave: `ativacao:${pessoa.etapa}:${pessoa.user_id}`,
      etiquetas: [{ name: "tipo", value: `ativacao_${pessoa.etapa}` }],
    });
    if (envio.ok) {
      relatorio.ativacao.enviados += 1;
      await marcar(pessoa.user_id, `ativacao_${pessoa.etapa}`, pessoa.etapa);
    } else {
      relatorio.ativacao.falhas += 1;
      console.error("E-mail de ativação falhou:", envio.erro);
    }
  }
  relatorio.ativacao.pendentes = Math.max(
    0,
    ((ativar ?? []) as ParaAtivar[]).length - filaAtivacao.length,
  );

  /* ---- Lembrete de revisão ---- */
  const { data: revisar, error: erroRevisar } = await supabase.rpc(
    "destinatarios_revisao",
    { p_segredo: segredo },
  );
  if (erroRevisar) {
    console.error("Falha ao listar revisões:", erroRevisar);
    return NextResponse.json({ erro: "falha" }, { status: 500 });
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const filaRevisao = ((revisar ?? []) as ParaRevisar[]).slice(
    0,
    TETO_POR_EXECUCAO,
  );
  for (const pessoa of filaRevisao) {
    const modelo = revisaoDoDia({
      nome: pessoa.nome,
      questoes: pessoa.questoes,
      diasAteProva: dias,
      site: site.url,
    });
    const envio = await enviar({
      para: pessoa.email,
      assunto: modelo.assunto,
      html: modelo.html,
      texto: modelo.texto,
      chave: `revisao:${pessoa.user_id}:${hoje}`,
      etiquetas: [{ name: "tipo", value: "revisao" }],
    });
    if (envio.ok) {
      relatorio.revisao.enviados += 1;
      await marcar(pessoa.user_id, "revisao", hoje);
    } else {
      relatorio.revisao.falhas += 1;
      console.error("Lembrete de revisão falhou:", envio.erro);
    }
  }

  /* ---- Plano acabando ---- */
  relatorio.revisao.pendentes = Math.max(
    0,
    ((revisar ?? []) as ParaRevisar[]).length - filaRevisao.length,
  );

  /* ---- Blocos do calendário de hoje ---- */
  const { data: agenda, error: erroAgenda } = await supabase.rpc(
    "destinatarios_calendario",
    { p_segredo: segredo },
  );
  if (erroAgenda) {
    console.error("Falha ao listar lembretes do calendário:", erroAgenda);
    return NextResponse.json({ ...relatorio, erro: "falha" }, { status: 500 });
  }
  const filaAgenda = ((agenda ?? []) as ParaLembrarCalendario[]).slice(
    0,
    TETO_POR_EXECUCAO,
  );
  for (const pessoa of filaAgenda) {
    const modelo = lembreteDoCalendario({
      nome: pessoa.nome,
      blocos: pessoa.blocos,
      minutos: pessoa.minutos,
      disciplinas: pessoa.disciplinas,
      horario: pessoa.horario,
      site: site.url,
    });
    const envio = await enviar({
      para: pessoa.email,
      assunto: modelo.assunto,
      html: modelo.html,
      texto: modelo.texto,
      chave: `calendario:${pessoa.user_id}:${hoje}`,
      etiquetas: [{ name: "tipo", value: "calendario" }],
    });
    if (envio.ok) {
      relatorio.calendario.enviados += 1;
      await marcar(pessoa.user_id, "calendario", hoje);
    } else {
      relatorio.calendario.falhas += 1;
      console.error("Lembrete do calendário falhou:", envio.erro);
    }
  }
  relatorio.calendario.pendentes = Math.max(
    0,
    ((agenda ?? []) as ParaLembrarCalendario[]).length - filaAgenda.length,
  );

  const { data: avisar, error: erroAvisar } = await supabase.rpc(
    "destinatarios_plano_acabando",
    { p_segredo: segredo, p_dias: 7 },
  );
  if (erroAvisar) {
    console.error("Falha ao listar planos a vencer:", erroAvisar);
    return NextResponse.json({ ...relatorio, erro: "falha" }, { status: 500 });
  }

  const filaAviso = ((avisar ?? []) as ParaAvisar[]).slice(
    0,
    TETO_POR_EXECUCAO,
  );
  for (const pessoa of filaAviso) {
    const nomeDoPlano =
      planos.find((p) => p.chave === pessoa.plano)?.nome ?? pessoa.plano;
    const modelo = planoAcabando({
      nome: pessoa.nome,
      plano: nomeDoPlano,
      validoAte: pessoa.fim,
      diasRestantes: Math.max(1, pessoa.dias_restantes),
      site: site.url,
    });
    const envio = await enviar({
      para: pessoa.email,
      assunto: modelo.assunto,
      html: modelo.html,
      texto: modelo.texto,
      chave: `plano:${pessoa.referencia}`,
      etiquetas: [{ name: "tipo", value: "plano_acabando" }],
    });
    if (envio.ok) {
      relatorio.planoAcabando.enviados += 1;
      await marcar(pessoa.user_id, "plano_acabando", pessoa.referencia);
    } else {
      relatorio.planoAcabando.falhas += 1;
      console.error("Aviso de fim de plano falhou:", envio.erro);
    }
  }

  relatorio.planoAcabando.pendentes = Math.max(
    0,
    ((avisar ?? []) as ParaAvisar[]).length - filaAviso.length,
  );

  console.info("Tarefa de e-mail:", JSON.stringify(relatorio));
  return NextResponse.json({ ok: true, ...relatorio });
}
