import { createClient } from "@supabase/supabase-js";
import { compraConfirmada } from "@/lib/email/modelos";
import { enviar } from "@/lib/email/resend";
import { consultarCobranca, ErroAsaas } from "@/lib/pagamento/asaas";
import { site } from "@/lib/site";
import { planos } from "@/lib/planos";
import { diasAte, getProximoExame } from "@/lib/content/queries";

/**
 * Transformar uma cobrança paga em acesso — o caminho único.
 *
 * Isto era o corpo de `/api/asaas/webhook`. Saiu de lá quando apareceu um
 * segundo chamador: a reconciliação diária, que percorre as cobranças ainda
 * pendentes e pergunta à Asaas se alguma foi paga sem que o evento chegasse.
 *
 * Duas cópias desta sequência divergiriam na primeira mudança, e a divergência
 * seria invisível: o caminho do webhook é o testado todo dia, o da
 * reconciliação só roda quando algo já deu errado. A ordem — reconsultar,
 * conferir status, ler o plano do **nosso** banco, calcular dias, confirmar,
 * avisar — é a parte que não pode variar entre eles.
 *
 * Quem chama decide o código HTTP. Aqui só existe o que aconteceu.
 */

/** Status que a Asaas considera dinheiro em caixa. */
const PAGOS = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

export type Confirmacao =
  /** Assinatura criada agora, ou já criada antes (a Asaas reenvia eventos). */
  | { tipo: "confirmada" | "ja_confirmada"; fim: string | null }
  /** Nada a fazer, e nada de errado: não repetir. */
  | { tipo: "ignorada"; motivo: string }
  /** Falha nossa: quem chamou deve tentar de novo. */
  | { tipo: "falha"; motivo: string };

function clienteSemSessao() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Quantos dias de acesso cada plano compra.
 *
 * `ate-a-prova` é o único que depende do calendário, e o calendário mora no
 * TypeScript (`aplicacoes`). Por isso a duração é calculada aqui e enviada em
 * dias para o banco, em vez de duplicar a data da prova numa tabela de
 * configuração que sairia de sincronia no primeiro edital novo.
 */
export async function diasDoPlano(chave: string): Promise<number | null> {
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

export async function confirmarCobranca(
  pagamentoId: string,
): Promise<Confirmacao> {
  const segredo = process.env.ASAAS_WEBHOOK_SEGREDO;
  if (!segredo) {
    return { tipo: "falha", motivo: "ASAAS_WEBHOOK_SEGREDO ausente" };
  }

  // O status que vale é o da Asaas, nunca o do corpo de um POST público.
  let statusReal: string;
  try {
    statusReal = (await consultarCobranca(pagamentoId)).status;
  } catch (erro) {
    // Pagamento que a Asaas não conhece é definitivo: reenviar não vai fazer
    // ele passar a existir. Qualquer outra falha é nossa, e merece repetição.
    const status = erro instanceof ErroAsaas ? (erro.status ?? 0) : 0;
    if (status === 404 || status === 400) {
      return { tipo: "ignorada", motivo: "pagamento inexistente na Asaas" };
    }
    return { tipo: "falha", motivo: "não consegui consultar a Asaas" };
  }

  if (!PAGOS.has(statusReal)) {
    return { tipo: "ignorada", motivo: `status ${statusReal}` };
  }

  const supabase = clienteSemSessao();

  // O plano vem da nossa tabela, não do evento — mesmo princípio do preço em
  // `/api/assinar`: o que chega de fora nunca decide o que a pessoa recebe.
  const { data: planoLocal, error: erroBusca } = await supabase.rpc(
    "plano_da_cobranca",
    { p_segredo: segredo, p_pagamento_id: pagamentoId },
  );
  if (erroBusca) {
    console.error("Falha ao ler a cobrança:", erroBusca);
    return { tipo: "falha", motivo: "não consegui ler a cobrança" };
  }
  if (!planoLocal) {
    return { tipo: "ignorada", motivo: "cobrança desconhecida" };
  }

  const dias = await diasDoPlano(String(planoLocal));
  if (dias === null) {
    console.error(`Plano desconhecido na cobrança ${pagamentoId}.`);
    return { tipo: "falha", motivo: "plano desconhecido" };
  }

  const { data, error } = await supabase.rpc("confirmar_pagamento", {
    p_segredo: segredo,
    p_pagamento_id: pagamentoId,
    p_dias: dias,
  });
  if (error) {
    console.error("Falha ao confirmar pagamento:", error);
    return { tipo: "falha", motivo: "não consegui confirmar" };
  }

  const linha = (Array.isArray(data) ? data[0] : data) as
    | { situacao: string; assinatura_fim: string | null }
    | undefined;

  if (linha?.situacao === "desconhecida") {
    return { tipo: "ignorada", motivo: "cobrança desconhecida" };
  }

  if (linha?.situacao === "confirmada") {
    await avisarCompra(supabase, segredo, pagamentoId);
    return { tipo: "confirmada", fim: linha.assinatura_fim };
  }

  return { tipo: "ja_confirmada", fim: linha?.assinatura_fim ?? null };
}

/**
 * E-mail de compra confirmada.
 *
 * **Nunca derruba a confirmação.** A assinatura já existe quando isto roda; um
 * erro aqui que virasse 500 faria a Asaas reenviar um evento que não tem mais
 * nada a confirmar. E-mail que não saiu vira log, não retentativa.
 */
async function avisarCompra(
  supabase: ReturnType<typeof clienteSemSessao>,
  segredo: string,
  pagamentoId: string,
) {
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

    if (!dados || dados.ja_avisado || !dados.fim) return;

    const modelo = compraConfirmada({
      nome: dados.nome,
      plano: planos.find((p) => p.chave === dados.plano)?.nome ?? dados.plano,
      validoAte: dados.fim,
      site: site.url,
    });
    const envio = await enviar({
      para: dados.email,
      assunto: modelo.assunto,
      html: modelo.html,
      texto: modelo.texto,
      // A Asaas reenvia o evento; a chave impede o segundo e-mail mesmo que a
      // marcação no banco ainda não tenha acontecido.
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
  } catch (erro) {
    console.error("Falha ao avisar a compra por e-mail:", erro);
  }
}
