import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { compraConfirmada } from "@/lib/email/modelos";
import { enviar } from "@/lib/email/resend";
import { consultarCobranca, ErroAsaas } from "@/lib/pagamento/asaas";
import { site } from "@/lib/site";
import { planos } from "@/lib/planos";
import { diasAte, getProximoExame } from "@/lib/content/queries";

/**
 * Webhook da Asaas.
 *
 * É aqui que a compra vira acesso. Sem esta rota, `/api/assinar` cria a
 * cobrança, a pessoa paga, e `assinaturas` continua vazia para sempre.
 *
 * Três guardas, e nenhuma delas sozinha basta:
 *
 * 1. **O token do cabeçalho.** A Asaas devolve em `asaas-access-token` o
 *    valor cadastrado no painel dela. Só confere quando `ASAAS_WEBHOOK_TOKEN`
 *    está configurado — em sandbox costuma não estar, e travar o
 *    desenvolvimento por causa disso não ajudaria ninguém.
 * 2. **A reconsulta na Asaas.** O corpo do POST é dado de entrada de uma URL
 *    pública: nada nele é levado a sério. O status que vale é o que vem de
 *    `GET /payments/{id}`.
 * 3. **O segredo do banco.** As funções `confirmar_pagamento` e
 *    `cancelar_pagamento` são `security definer` liberadas para `anon`, e o
 *    que impede qualquer pessoa de chamá-las é um segredo que vive em
 *    `interno.segredos` — esquema sem permissão para papel nenhum.
 *
 * O cliente Supabase aqui é criado sem cookie de propósito: não há sessão
 * numa requisição de máquina. Continua sendo a chave anônima — a service role
 * segue restrita ao pipeline de ingestão, fora do Next.
 */

type EventoAsaas = {
  event?: string;
  payment?: { id?: string; status?: string };
};

const CONFIRMAM = new Set([
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_RECEIVED_IN_CASH",
]);

const CANCELAM = new Set([
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
  "PAYMENT_REVERSED",
]);

/** Status que a Asaas considera dinheiro em caixa. */
const PAGOS = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

/**
 * Quantos dias de acesso cada plano compra.
 *
 * `ate-a-prova` é o único que depende do calendário, e o calendário mora no
 * TypeScript (`proximoExame`). Por isso a duração é calculada aqui e enviada
 * em dias para o banco, em vez de duplicar a data da prova numa tabela de
 * configuração que sairia de sincronia no primeiro edital novo.
 */
async function diasDoPlano(chave: string): Promise<number | null> {
  if (!planos.some((p) => p.chave === chave)) return null;

  switch (chave) {
    case "experimentar":
      return 7;
    case "mensal":
      return 30;
    case "anual":
      return 365;
    case "ate-a-prova": {
      const proximo = await getProximoExame();
      // Quem compra na véspera não pode receber um plano de um dia: o piso de
      // 30 dias cobre a semana da prova e a espera pelo resultado.
      return Math.max(30, diasAte(proximo.data));
    }
    default:
      return null;
  }
}

function clienteSemSessao() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(request: Request) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (esperado && request.headers.get("asaas-access-token") !== esperado) {
    console.warn("Webhook Asaas recusado: token inválido.");
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const segredo = process.env.ASAAS_WEBHOOK_SEGREDO;
  if (!segredo) {
    console.error("ASAAS_WEBHOOK_SEGREDO não configurada.");
    return NextResponse.json({ erro: "não configurado" }, { status: 500 });
  }

  let evento: EventoAsaas;
  try {
    evento = (await request.json()) as EventoAsaas;
  } catch {
    return NextResponse.json({ erro: "corpo inválido" }, { status: 400 });
  }

  const tipo = evento.event ?? "";
  const pagamentoId = evento.payment?.id;

  // Evento que não muda acesso — cobrança criada, vencida, e-mail enviado.
  // Precisa de 2xx: a Asaas reenvia enquanto não receber, para sempre.
  if (!pagamentoId || (!CONFIRMAM.has(tipo) && !CANCELAM.has(tipo))) {
    return NextResponse.json({ ok: true, ignorado: tipo });
  }

  const supabase = clienteSemSessao();

  if (CANCELAM.has(tipo)) {
    const { data, error } = await supabase.rpc("cancelar_pagamento", {
      p_segredo: segredo,
      p_pagamento_id: pagamentoId,
      p_status: evento.payment?.status ?? "REFUNDED",
    });
    if (error) {
      console.error("Falha ao cancelar pagamento:", error);
      return NextResponse.json({ erro: "falha" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, resultado: data });
  }

  // ---- Confirmação ----
  let statusReal: string;
  try {
    const cobranca = await consultarCobranca(pagamentoId);
    statusReal = cobranca.status;
  } catch (erro) {
    // Pagamento que a Asaas não conhece é definitivo: reenviar não vai fazer
    // ele passar a existir, e devolver 500 põe a Asaas num laço de retentativa
    // para sempre. Qualquer outra falha é nossa — aí 500 é o certo, porque
    // perder a confirmação significa alguém pagar e não receber acesso.
    const status =
      erro instanceof ErroAsaas ? (erro.status ?? 0) : 0;
    if (status === 404 || status === 400) {
      console.warn(`Asaas não conhece o pagamento ${pagamentoId}.`);
      return NextResponse.json({ ok: true, ignorado: "pagamento inexistente" });
    }
    console.error("Falha ao reconsultar cobrança na Asaas:", erro);
    return NextResponse.json({ erro: "falha na consulta" }, { status: 500 });
  }

  if (!PAGOS.has(statusReal)) {
    console.warn(
      `Webhook ${tipo} para ${pagamentoId}, mas a Asaas diz ${statusReal}.`,
    );
    return NextResponse.json({ ok: true, ignorado: statusReal });
  }

  // O plano vem da nossa tabela, não do corpo do evento — é o mesmo princípio
  // do preço em `/api/assinar`: o que o cliente informa nunca decide o que
  // ele recebe.
  const { data: cobrancaLocal, error: erroBusca } = await supabase.rpc(
    "plano_da_cobranca",
    { p_segredo: segredo, p_pagamento_id: pagamentoId },
  );
  if (erroBusca) {
    console.error("Falha ao ler a cobrança:", erroBusca);
    return NextResponse.json({ erro: "falha" }, { status: 500 });
  }
  if (!cobrancaLocal) {
    return NextResponse.json({ ok: true, ignorado: "cobranca desconhecida" });
  }

  const dias = await diasDoPlano(String(cobrancaLocal));
  if (dias === null) {
    console.error(`Plano desconhecido na cobrança ${pagamentoId}.`);
    return NextResponse.json({ erro: "plano desconhecido" }, { status: 500 });
  }

  const { data, error } = await supabase.rpc("confirmar_pagamento", {
    p_segredo: segredo,
    p_pagamento_id: pagamentoId,
    p_dias: dias,
  });

  if (error) {
    console.error("Falha ao confirmar pagamento:", error);
    return NextResponse.json({ erro: "falha" }, { status: 500 });
  }

  const linha = (Array.isArray(data) ? data[0] : data) as
    | { situacao: string; assinatura_fim: string | null }
    | undefined;

  /* Confirmação por e-mail. Até existir, alguém pagava e recebia só o
     comprovante do gateway — que não diz o que foi liberado nem até quando.

     Falha aqui **não** derruba a resposta: a assinatura já está criada, e
     devolver 500 faria a Asaas reenviar um evento que não tem mais nada a
     confirmar. O e-mail que não saiu vira log, não retentativa. */
  if (linha?.situacao === "confirmada") {
    try {
      const { data: compra } = await supabase.rpc("dados_da_compra", {
        p_segredo: segredo,
        p_pagamento_id: pagamentoId,
      });
      const dados = (Array.isArray(compra) ? compra[0] : compra) as
        | {
            user_id: string;
            email: string;
            nome: string;
            plano: string;
            fim: string;
            ja_avisado: boolean;
          }
        | undefined;

      if (dados && !dados.ja_avisado && dados.fim) {
        const nomeDoPlano =
          planos.find((p) => p.chave === dados.plano)?.nome ?? dados.plano;
        const modelo = compraConfirmada({
          nome: dados.nome,
          plano: nomeDoPlano,
          validoAte: dados.fim,
          site: site.url,
        });
        const envio = await enviar({
          para: dados.email,
          assunto: modelo.assunto,
          html: modelo.html,
          texto: modelo.texto,
          // A Asaas reenvia o evento; a chave impede o segundo e-mail mesmo
          // que a marcação no banco ainda não tenha acontecido.
          chave: `compra:${pagamentoId}`,
          etiquetas: [{ name: "tipo", value: "compra" }],
        });

        if (envio.ok) {
          await supabase.rpc("registrar_email", {
            p_segredo: segredo,
            p_user_id: dados.user_id,
            p_tipo: "compra",
            p_referencia: pagamentoId,
          });
        } else {
          console.error("E-mail de compra não enviado:", envio.erro);
        }
      }
    } catch (erro) {
      console.error("Falha ao avisar a compra por e-mail:", erro);
    }
  }

  console.info(
    `Webhook Asaas ${tipo} ${pagamentoId}: ${linha?.situacao ?? "sem retorno"}`,
  );
  return NextResponse.json({ ok: true, resultado: linha });
}
