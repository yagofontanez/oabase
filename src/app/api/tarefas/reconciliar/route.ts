import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  ambienteAsaas,
  cancelarAssinatura,
  cobrancasDaAssinatura,
} from "@/lib/pagamento/asaas";
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

/** Assinaturas olhadas por execução — cada uma custa uma ida à Asaas, mais
    uma por pagamento recente. Acima disso, as execuções se revezam. */
const ASSINATURAS_POR_EXECUCAO = 25;

/**
 * Fatura vencida há mais que isso encerra a assinatura. Nunca pagou nada:
 * desistiu no checkout. Já pagou antes: parou de pagar — e a Asaas geraria
 * fatura todo mês, para sempre, com o nosso aviso junto.
 */
const DIAS_PARA_ABANDONO = 5;
const DIAS_PARA_INADIMPLENCIA = 30;

const PAGOS = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

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

  const supabase = clienteSemSessao();

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

  const assinaturas = await reconciliarAssinaturas(supabase, segredo);

  // 200 mesmo com falhas: elas voltam na execução seguinte, e o relatório vai
  // para o log da Netlify. Devolver erro aqui só marcaria o cron como quebrado
  // quando quem está fora do ar é a Asaas.
  return NextResponse.json({ ok: true, ...relatorio, assinaturas });
}

/**
 * As renovações que o webhook perdeu, e as assinaturas abandonadas.
 *
 * Uma renovação só entra em `cobrancas` quando o pagamento dela é processado
 * — então, se o evento não chega, ela não está em lugar nenhum do nosso lado,
 * e a varredura das `PENDING` acima nunca a veria. Aqui a pergunta é feita à
 * Asaas: quais cobranças desta assinatura estão pagas? Cada uma passa por
 * `confirmarCobranca`, que é idempotente — as já confirmadas saem como
 * `ja_confirmada`, sem dobrar validade nem e-mail.
 *
 * Abandono: quem abriu a assinatura e nunca pagou a primeira fatura. Sem
 * cancelar, a Asaas geraria a fatura do mês seguinte para alguém que
 * desistiu, e a recorrência aberta impediria a pessoa de assinar de novo.
 */
async function reconciliarAssinaturas(
  supabase: ReturnType<typeof clienteSemSessao>,
  segredo: string,
) {
  const relatorio = { verificadas: 0, confirmadas: 0, abandonadas: 0, falhas: 0 };

  const { data, error } = await supabase.rpc("recorrencias_a_reconciliar", {
    p_segredo: segredo,
    p_ambiente: ambienteAsaas,
  });
  if (error) {
    console.error("Falha ao listar assinaturas:", error);
    relatorio.falhas++;
    return relatorio;
  }

  const todas = ((data ?? []) as { assinatura_id: string }[]).map((r) => r.assinatura_id);
  // Revezamento por hora: com mais assinaturas do que cabem numa execução,
  // cada fatia é olhada uma vez a cada poucas horas, em vez de a cauda nunca.
  const fatias = Math.max(1, Math.ceil(todas.length / ASSINATURAS_POR_EXECUCAO));
  const fatia = new Date().getUTCHours() % fatias;
  const desta = todas.slice(fatia * ASSINATURAS_POR_EXECUCAO, (fatia + 1) * ASSINATURAS_POR_EXECUCAO);

  const diasAtras = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const recenteIso = diasAtras(45);

  for (const id of desta) {
    relatorio.verificadas++;
    try {
      const cobrancas = (await cobrancasDaAssinatura(id)).filter((c) => !c.deleted);
      const pagas = cobrancas.filter((c) => PAGOS.has(c.status));

      // Primeiro o que foi pago: encerrar antes de confirmar perderia o mês
      // de quem pagou a fatura atrasada no mesmo dia do corte.
      for (const cobranca of pagas.filter((c) => c.dueDate >= recenteIso)) {
        const resultado = await confirmarCobranca(cobranca.id);
        if (resultado.tipo === "confirmada") {
          relatorio.confirmadas++;
          console.error(
            `Reconciliação confirmou a renovação ${cobranca.id} da assinatura ${id}:` +
              " o webhook não processou este pagamento.",
          );
        } else if (resultado.tipo === "falha") {
          relatorio.falhas++;
        }
      }

      const corte = diasAtras(pagas.length ? DIAS_PARA_INADIMPLENCIA : DIAS_PARA_ABANDONO);
      const esquecida = cobrancas.find((c) => c.status === "OVERDUE" && c.dueDate < corte);
      if (esquecida || cobrancas.length === 0) {
        await cancelarAssinatura(id);
        await supabase.rpc("encerrar_recorrencia", { p_segredo: segredo, p_assinatura_id: id });
        relatorio.abandonadas++;
        console.info(`Assinatura ${id} encerrada: fatura de ${esquecida?.dueDate ?? "—"} sem pagamento.`);
      }
    } catch (erro) {
      console.error(`Falha ao reconciliar a assinatura ${id}:`, erro);
      relatorio.falhas++;
    }
  }
  return relatorio;
}
