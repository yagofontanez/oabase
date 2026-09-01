/**
 * Cliente do Resend. **Somente servidor** — `RESEND_API_KEY` não tem prefixo
 * público e nunca chega ao navegador.
 *
 * Sem SDK, pelo mesmo motivo de `pagamento/asaas.ts`: são duas chamadas HTTP,
 * e uma dependência a mais custa mais do que o `fetch` que ela embrulha.
 *
 * **O envio nunca derruba o que o chamou.** Um e-mail de confirmação que
 * falha não pode desfazer uma compra confirmada, e um lembrete que falha não
 * pode quebrar a rotina diária. Por isso `enviar` devolve o resultado em vez
 * de lançar — quem chama decide, e o padrão é registrar e seguir.
 */

const API = "https://api.resend.com/emails";

/**
 * Remetente. Precisa ser um endereço do domínio verificado no Resend, senão
 * a API recusa com 403. Configurável para permitir subir com o domínio ainda
 * em verificação usando o `onboarding@resend.dev`.
 */
export const remetente =
  process.env.EMAIL_REMETENTE ?? "OABase <ola@oabase.com.br>";

export const respostaPara = process.env.EMAIL_RESPOSTA ?? undefined;

export type ResultadoDeEnvio =
  | { ok: true; id: string }
  | { ok: false; erro: string };

export async function enviar(mensagem: {
  para: string;
  assunto: string;
  html: string;
  texto: string;
  /**
   * Chave de idempotência. O Resend descarta o segundo envio com a mesma
   * chave dentro de 24h — é a rede de segurança para a retentativa do
   * webhook da Asaas e para o cron rodando duas vezes.
   */
  chave?: string;
  etiquetas?: { name: string; value: string }[];
}): Promise<ResultadoDeEnvio> {
  const chaveApi = process.env.RESEND_API_KEY;
  if (!chaveApi) {
    return { ok: false, erro: "RESEND_API_KEY não configurada" };
  }

  try {
    const resposta = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chaveApi}`,
        "Content-Type": "application/json",
        ...(mensagem.chave ? { "Idempotency-Key": mensagem.chave } : {}),
      },
      body: JSON.stringify({
        from: remetente,
        to: [mensagem.para],
        subject: mensagem.assunto,
        html: mensagem.html,
        // Toda mensagem vai com versão em texto. Sem ela, filtro de spam
        // pontua pior e quem lê no terminal ou no relógio não lê nada.
        text: mensagem.texto,
        ...(respostaPara ? { reply_to: respostaPara } : {}),
        ...(mensagem.etiquetas ? { tags: mensagem.etiquetas } : {}),
      }),
      cache: "no-store",
    });

    const dados = (await resposta.json().catch(() => null)) as
      | { id?: string; message?: string; name?: string }
      | null;

    if (!resposta.ok || !dados?.id) {
      return {
        ok: false,
        erro: dados?.message ?? `Resend respondeu ${resposta.status}`,
      };
    }
    return { ok: true, id: dados.id };
  } catch (erro) {
    return { ok: false, erro: String(erro) };
  }
}
