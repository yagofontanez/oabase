import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { confirmarCobranca } from "@/lib/pagamento/confirmar";
import { consultarAssinatura, ErroAsaas } from "@/lib/pagamento/asaas";

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
 * 2. **A reconsulta na Asaas**, dentro de `confirmarCobranca`. O corpo do
 *    POST é dado de entrada de uma URL pública: nada nele é levado a sério.
 *    O status que vale é o que vem de `GET /payments/{id}`.
 * 3. **O segredo do banco.** As funções `confirmar_pagamento` e
 *    `cancelar_pagamento` são `security definer` liberadas para `anon`, e o
 *    que impede qualquer pessoa de chamá-las é um segredo que vive em
 *    `interno.segredos` — esquema sem permissão para papel nenhum.
 *
 * A sequência da confirmação vive em `@/lib/pagamento/confirmar` porque a
 * reconciliação diária (`/api/tarefas/reconciliar`) percorre exatamente o
 * mesmo caminho. O que esta rota decide é o código HTTP — e cada um deles
 * significa uma coisa para a Asaas, que reenvia até receber 2xx.
 *
 * O cliente Supabase aqui é criado sem cookie de propósito: não há sessão
 * numa requisição de máquina. Continua sendo a chave anônima — a service role
 * segue restrita ao pipeline de ingestão, fora do Next.
 */

type EventoAsaas = {
  event?: string;
  payment?: { id?: string; status?: string };
  subscription?: { id?: string };
};

/**
 * Assinatura que deixou de existir do lado da Asaas — removida no painel, ou
 * inativada por ela. O cancelamento feito pela pessoa já marca o banco na
 * própria rota; este é o caminho de quem cancela por fora do OABase.
 *
 * Reconsulta antes de marcar, como no pagamento. Um "cancelada" forjado não
 * libera acesso, mas faria a tela dizer "cancelada" com a Asaas ainda
 * cobrando — e liberaria uma segunda assinatura, que é cobrança em dobro.
 */
const ENCERRAM = new Set(["SUBSCRIPTION_DELETED", "SUBSCRIPTION_INACTIVATED"]);

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

  if (ENCERRAM.has(tipo) && evento.subscription?.id) {
    try {
      const real = await consultarAssinatura(evento.subscription.id);
      if (!real.deleted && real.status === "ACTIVE") {
        return NextResponse.json({ ok: true, ignorado: "assinatura ativa na Asaas" });
      }
    } catch (erro) {
      const status = erro instanceof ErroAsaas ? (erro.status ?? 0) : 0;
      // 404 é "não existe mais", que é o que o evento diz. O resto é falha
      // de conversa com a Asaas: 500 para ela reenviar.
      if (status !== 404) {
        return NextResponse.json({ erro: "não consegui consultar a Asaas" }, { status: 500 });
      }
    }
    const { error } = await clienteSemSessao().rpc("encerrar_recorrencia", {
      p_segredo: segredo,
      p_assinatura_id: evento.subscription.id,
    });
    if (error) {
      console.error("Falha ao encerrar recorrência:", error);
      return NextResponse.json({ erro: "falha" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, encerrada: evento.subscription.id });
  }

  // Evento que não muda acesso — cobrança criada, vencida, e-mail enviado.
  // Precisa de 2xx: a Asaas reenvia enquanto não receber, para sempre.
  if (!pagamentoId || (!CONFIRMAM.has(tipo) && !CANCELAM.has(tipo))) {
    return NextResponse.json({ ok: true, ignorado: tipo });
  }

  if (CANCELAM.has(tipo)) {
    const supabase = clienteSemSessao();
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

  const resultado = await confirmarCobranca(pagamentoId);

  // 500 só quando a falha é nossa: aí a retentativa da Asaas é exatamente o
  // que se quer, porque perder a confirmação é alguém pagar e não receber.
  if (resultado.tipo === "falha") {
    return NextResponse.json({ erro: resultado.motivo }, { status: 500 });
  }

  console.info(`Webhook Asaas ${tipo} ${pagamentoId}: ${resultado.tipo}`);
  return NextResponse.json({ ok: true, resultado });
}
