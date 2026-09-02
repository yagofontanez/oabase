/**
 * A fronteira aberto/pago, afirmada em código executável.
 *
 * É a regra mais importante do repositório e a única que nenhum tipo do
 * TypeScript protege: quem decide é a RLS, no Postgres, e ela não aparece em
 * nenhum `import`. Uma política derrubada por engano numa migration futura não
 * quebra o build, não quebra o lint e não quebra nenhuma tela — o site
 * continua bonito, servindo o produto pago de graça, e a descoberta vem por
 * alguém avisando.
 *
 * Este script fala com o PostgREST **como o navegador de um visitante
 * anônimo**, com a mesma chave pública que está no HTML, e afirma as duas
 * metades da regra: o que tem de estar aberto responde, e o que é pago volta
 * vazio. Sem dependência nenhuma — `fetch` puro, que é o que o navegador
 * também usaria.
 *
 *     pnpm fronteira
 *
 * Nada aqui escreve. As tentativas de escrita são justamente o que precisa
 * falhar, e falham antes de tocar em linha nenhuma.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !chave) {
  console.error(
    "Faltam NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.\n" +
      "Rode com: node --env-file=.env.local scripts/fronteira.mjs",
  );
  process.exit(2);
}

const cabecalhos = { apikey: chave, Authorization: `Bearer ${chave}` };

async function selecionar(tabela, colunas = "*") {
  const resposta = await fetch(
    `${url}/rest/v1/${tabela}?select=${colunas}&limit=5`,
    { headers: cabecalhos },
  );
  const corpo = await resposta.text();
  let linhas = [];
  try {
    const dado = JSON.parse(corpo);
    linhas = Array.isArray(dado) ? dado : [];
  } catch {
    /* erro do PostgREST não é lista — fica em `linhas = []`. */
  }
  return { status: resposta.status, linhas, corpo };
}

async function chamar(funcao, argumentos) {
  const resposta = await fetch(`${url}/rest/v1/rpc/${funcao}`, {
    method: "POST",
    headers: { ...cabecalhos, "Content-Type": "application/json" },
    body: JSON.stringify(argumentos),
  });
  return { status: resposta.status, corpo: await resposta.text() };
}

async function inserir(tabela, linha) {
  const resposta = await fetch(`${url}/rest/v1/${tabela}`, {
    method: "POST",
    headers: { ...cabecalhos, "Content-Type": "application/json" },
    body: JSON.stringify(linha),
  });
  return { status: resposta.status, corpo: await resposta.text() };
}

const casos = [];
function caso(nome, executar) {
  casos.push({ nome, executar });
}

// ---------------------------------------------------------------------------
// Aberto: se isto quebrar, o site perde a camada que traz gente.
// ---------------------------------------------------------------------------

for (const tabela of ["leis", "artigos", "exames", "disciplinas"]) {
  caso(`anônimo lê ${tabela}`, async () => {
    const { status, linhas } = await selecionar(tabela, "id");
    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (linhas.length === 0) throw new Error("nenhuma linha");
  });
}

// ---------------------------------------------------------------------------
// Pago: se isto quebrar, o produto está de graça e ninguém percebe.
// ---------------------------------------------------------------------------

for (const tabela of ["questoes", "comentarios", "perfis", "assinaturas"]) {
  caso(`anônimo NÃO lê ${tabela}`, async () => {
    const { status, linhas } = await selecionar(tabela, "id");
    // 200 com zero linhas é o comportamento normal da RLS; 401/403 também
    // serve. O que não pode existir é linha na resposta.
    if (linhas.length > 0) {
      throw new Error(`${linhas.length} linha(s) vazaram (HTTP ${status})`);
    }
  });
}

caso("a fila de questões volta vazia sem assinatura", async () => {
  const { corpo } = await chamar("fila_de_questoes", {
    p_modo: "todas",
    p_exame: null,
    p_disciplina: null,
    p_limite: 5,
  });
  if (/"enunciado"/.test(corpo)) throw new Error("veio enunciado de questão");
});

caso("nem a fila nem nada devolve gabarito", async () => {
  const { corpo } = await selecionar("questoes", "gabarito");
  if (/"gabarito"\s*:\s*"[A-D]"/.test(corpo)) {
    throw new Error("gabarito no corpo da resposta");
  }
});

// ---------------------------------------------------------------------------
// Escrita: o que impede alguém de se dar um plano.
// ---------------------------------------------------------------------------

caso("anônimo não cria assinatura", async () => {
  const { status } = await inserir("assinaturas", {
    user_id: "00000000-0000-0000-0000-000000000000",
    plano: "anual",
    fim: "2099-01-01",
  });
  if (status < 400) throw new Error(`insert aceito (HTTP ${status})`);
});

caso("anônimo não forja cobrança confirmada", async () => {
  const { status } = await inserir("cobrancas", {
    user_id: "00000000-0000-0000-0000-000000000000",
    plano: "anual",
    valor: 1,
    ambiente: "sandbox",
    asaas_pagamento_id: "pay_fronteira_teste",
    status: "CONFIRMED",
    url_fatura: "https://exemplo.invalido",
  });
  if (status < 400) throw new Error(`insert aceito (HTTP ${status})`);
});

caso("confirmar_pagamento exige o segredo do banco", async () => {
  const { corpo } = await chamar("confirmar_pagamento", {
    p_segredo: "segredo-errado",
    p_pagamento_id: "pay_fronteira_teste",
    p_dias: 365,
  });
  if (!/segredo inválido/.test(corpo)) {
    throw new Error(`resposta inesperada: ${corpo.slice(0, 120)}`);
  }
});

caso("cobrancas_a_reconciliar exige o segredo do banco", async () => {
  const { corpo } = await chamar("cobrancas_a_reconciliar", {
    p_segredo: "segredo-errado",
    p_ambiente: "producao",
    p_dias: 7,
    p_limite: 5,
  });
  if (!/segredo inválido/.test(corpo)) {
    throw new Error(`resposta inesperada: ${corpo.slice(0, 120)}`);
  }
});

// ---------------------------------------------------------------------------

let falhas = 0;
for (const { nome, executar } of casos) {
  try {
    await executar();
    console.log(`  ok   ${nome}`);
  } catch (erro) {
    falhas++;
    console.log(`  FALHA ${nome} — ${erro.message}`);
  }
}

console.log(
  falhas === 0
    ? `\n${casos.length} afirmações, nenhuma falha.`
    : `\n${falhas} de ${casos.length} falharam.`,
);
process.exit(falhas === 0 ? 0 : 1);
