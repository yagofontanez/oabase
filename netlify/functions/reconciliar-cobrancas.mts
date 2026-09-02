import type { Config } from "@netlify/functions";

/**
 * Reconciliação horária das cobranças pendentes.
 *
 * Função separada da de e-mails de propósito: são capacidades diferentes e
 * cadências diferentes, e uma falha na de e-mail não pode esconder a de
 * pagamento no painel. Como a outra, ela só chama a rota — a lógica vive
 * dentro do Next, onde os imports `@/...` resolvem.
 *
 * **De hora em hora, e não uma vez por dia**, porque o que esta tarefa
 * conserta é alguém que pagou e está esperando. Vinte e três horas de espera
 * para receber o que já se comprou é indistinguível, para quem comprou, de
 * ter sido roubado. A execução é barata: sem cobrança pendente, é uma
 * consulta que não devolve linha nenhuma.
 */
export default async () => {
  const base = process.env.URL;
  const segredo = process.env.CRON_SECRET;

  if (!base || !segredo) {
    console.error(
      "reconciliar-cobrancas: falta URL ou CRON_SECRET no ambiente do projeto.",
    );
    return new Response("configuração ausente", { status: 500 });
  }

  const resposta = await fetch(`${base}/api/tarefas/reconciliar`, {
    headers: { Authorization: `Bearer ${segredo}` },
  });
  const corpo = await resposta.text();

  console.info(`reconciliar-cobrancas: ${resposta.status} ${corpo.slice(0, 300)}`);

  if (!resposta.ok) {
    return new Response(corpo, { status: resposta.status });
  }
  return new Response(corpo, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

export const config: Config = {
  schedule: "17 * * * *",
};
