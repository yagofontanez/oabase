import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ambienteAsaas } from "@/lib/pagamento/asaas";
import { confirmarCobranca } from "@/lib/pagamento/confirmar";

/**
 * Reconciliação de cobranças — a rede de segurança do webhook.
 *
 * Todo o acesso pago depende de um POST da Asaas chegar em
 * `/api/asaas/webhook`. Se ele não chegar — um deploy no ar naquele minuto,
 * instabilidade de rede, token trocado no painel e não no ambiente —, a
 * pessoa paga, a Asaas registra, e `assinaturas` continua vazia. Nada no
 * sistema percebe: a primeira notícia vem por reclamação, do cliente que
 * mais confiava no produto.
 *
 * Esta rota pergunta de novo. Pega as cobranças que ainda estão `PENDING`
 * para nós, reconsulta cada uma na Asaas e confirma as que estiverem pagas —
 * pelo mesmo caminho do webhook, `confirmarCobranca`, para que o resultado
 * seja idêntico ao que teria acontecido se o evento tivesse chegado.
 *
 * **É idempotente por construção.** `confirmar_pagamento` sai pela porta dos
 * fundos quando a cobrança já está `CONFIRMED`, então rodar de hora em hora
 * não dobra validade nem reenvia e-mail.
 *
 * Cada linha reconciliada é um `console.error`: não é operação normal. Se
 * aparecerem várias, o webhook está quebrado e o certo é consertar o webhook
 * — esta tarefa é rede, não chão.
 */

export const dynamic = "force-dynamic";

/**
 * Teto por execução, pelo mesmo motivo do teto de e-mails: a função síncrona
 * da Netlify tem segundos de vida, e cada cobrança aqui custa uma ida à
 * Asaas. O que sobrar entra na execução seguinte — que é daqui a uma hora.
 */
const TETO_POR_EXECUCAO = 25;

function autorizado(request: Request) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  return request.headers.get("authorization") === `Bearer ${esperado}`;
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  // O segredo é o do webhook, não o do cron: a separação em
  // `interno.segredos` é por capacidade, e isto aqui confirma pagamento.
  const segredo = process.env.ASAAS_WEBHOOK_SEGREDO;
  if (!segredo) {
    console.error("ASAAS_WEBHOOK_SEGREDO não configurada.");
    return NextResponse.json({ erro: "não configurado" }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabase.rpc("cobrancas_a_reconciliar", {
    p_segredo: segredo,
    p_ambiente: ambienteAsaas,
    p_dias: 7,
    p_limite: TETO_POR_EXECUCAO,
  });

  if (error) {
    console.error("Falha ao listar cobranças pendentes:", error);
    return NextResponse.json({ erro: "falha na consulta" }, { status: 500 });
  }

  const pendentes = (data ?? []) as { pagamento_id: string; plano: string }[];
  const relatorio = {
    ambiente: ambienteAsaas,
    verificadas: pendentes.length,
    confirmadas: 0,
    aindaPendentes: 0,
    falhas: 0,
  };

  for (const cobranca of pendentes) {
    const resultado = await confirmarCobranca(cobranca.pagamento_id);

    switch (resultado.tipo) {
      case "confirmada":
        relatorio.confirmadas++;
        // Chegar aqui significa que o webhook falhou para esta cobrança. A
        // pessoa recebeu o acesso agora, mas o buraco continua aberto.
        console.error(
          `Reconciliação confirmou ${cobranca.pagamento_id} (${cobranca.plano}):` +
            " o webhook não processou este pagamento.",
        );
        break;
      case "ja_confirmada":
        // Confirmada no banco com a cobrança ainda `PENDING` não deveria
        // existir — as duas escritas são da mesma função, na mesma transação.
        relatorio.confirmadas++;
        break;
      case "falha":
        relatorio.falhas++;
        break;
      default:
        relatorio.aindaPendentes++;
    }
  }

  // 200 mesmo com falhas: elas voltam na execução seguinte, e o relatório vai
  // para o log da Netlify. Devolver erro aqui só marcaria o cron como quebrado
  // quando quem está fora do ar é a Asaas.
  return NextResponse.json({ ok: true, ...relatorio });
}
