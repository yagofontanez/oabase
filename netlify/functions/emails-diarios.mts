import type { Config } from "@netlify/functions";

/**
 * Disparo diário dos e-mails agendados: lembrete de revisão e aviso de fim
 * de plano.
 *
 * Por que uma função só chamando uma rota, em vez de fazer o trabalho aqui:
 * a lógica vive em `/api/tarefas/emails`, que roda dentro do Next e tem
 * acesso aos módulos do app (`@/lib/email`, `@/lib/planos`, as consultas do
 * conteúdo). Duplicar isso numa função avulsa criaria duas verdades sobre
 * quem recebe o quê — e as funções da Netlify são empacotadas pelo esbuild,
 * fora do resolvedor de paths do Next, então o import `@/...` não vale aqui.
 *
 * `process.env.URL` é a URL primária do projeto, injetada pela Netlify em
 * tempo de execução. Em deploy de branch ela aponta para o deploy da branch,
 * o que é o desejado: o cron de produção só existe no projeto de produção.
 */
export default async () => {
  const base = process.env.URL;
  const segredo = process.env.CRON_SECRET;

  if (!base || !segredo) {
    console.error(
      "emails-diarios: falta URL ou CRON_SECRET no ambiente do projeto.",
    );
    // 500 faz a Netlify registrar a execução como falha, que é o que se quer:
    // um cron que não roda tem de aparecer no painel, não sumir em silêncio.
    return new Response("configuração ausente", { status: 500 });
  }

  const resposta = await fetch(`${base}/api/tarefas/emails`, {
    headers: { Authorization: `Bearer ${segredo}` },
  });
  const corpo = await resposta.text();

  console.info(`emails-diarios: ${resposta.status} ${corpo.slice(0, 300)}`);

  if (!resposta.ok) {
    return new Response(corpo, { status: resposta.status });
  }
  return new Response(corpo, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

/**
 * 11:00 UTC = 08:00 em Brasília.
 *
 * Fixo em UTC porque o cron da Netlify não conhece fuso — e é melhor assim:
 * no horário de verão o e-mail chegaria uma hora antes ou depois, e ninguém
 * vai reclamar de um lembrete de estudo às 7h ou às 9h.
 */
export const config: Config = {
  schedule: "0 11 * * *",
};
