import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { planoAcabando, revisaoDoDia } from "@/lib/email/modelos";
import { enviar } from "@/lib/email/resend";
import { site } from "@/lib/site";
import { diasAte, getProximoExame } from "@/lib/content/queries";
import { planos } from "@/lib/planos";

/**
 * Tarefa diária de e-mail: lembrete de revisão e aviso de fim de plano.
 *
 * Chamada pelo Cron da Vercel, que envia `Authorization: Bearer $CRON_SECRET`.
 * Sem sessão, como o webhook — e a saída é a mesma: funções `security
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
export const maxDuration = 300;

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
    revisao: { enviados: 0, falhas: 0 },
    planoAcabando: { enviados: 0, falhas: 0 },
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
  for (const pessoa of (revisar ?? []) as ParaRevisar[]) {
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
  const { data: avisar, error: erroAvisar } = await supabase.rpc(
    "destinatarios_plano_acabando",
    { p_segredo: segredo, p_dias: 7 },
  );
  if (erroAvisar) {
    console.error("Falha ao listar planos a vencer:", erroAvisar);
    return NextResponse.json({ ...relatorio, erro: "falha" }, { status: 500 });
  }

  for (const pessoa of (avisar ?? []) as ParaAvisar[]) {
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

  console.info("Tarefa de e-mail:", JSON.stringify(relatorio));
  return NextResponse.json({ ok: true, ...relatorio });
}
