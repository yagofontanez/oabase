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

// `buscar_dispositivos` é security invoker sobre tabelas abertas, e por isso
// pode ser chamada pelo papel anônimo — é a mesma leitura que a página de
// legislação já faz. O que se afirma aqui é que ela continua achando o que
// deve achar; a metade oposta (não vazar questão) está garantida por ela não
// tocar em `questoes`, e por ser invoker se um dia tocar.
caso("anônimo busca dispositivo por texto", async () => {
  const { status, corpo } = await chamar("buscar_dispositivos", {
    termo: "furto",
    limite: 3,
  });
  if (status !== 200) throw new Error(`HTTP ${status}`);
  const linhas = JSON.parse(corpo);
  if (linhas.length === 0) throw new Error("nenhum dispositivo");
});

// ---------------------------------------------------------------------------
// Pago: se isto quebrar, o produto está de graça e ninguém percebe.
// ---------------------------------------------------------------------------

for (const tabela of [
  "questoes",
  "comentarios",
  "perfis",
  "assinaturas",
  // Quem assina o Mensal, e o id da assinatura na Asaas.
  "recorrencias",
  "tickets",
  "ticket_mensagens",
  // O fórum é aberto a qualquer conta, e fechado a quem não tem nenhuma:
  // conteúdo de terceiro indexável é o caminho curto para o domínio ser
  // avaliado como fazenda de conteúdo.
  "forum_topicos",
  "forum_respostas",
]) {
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

// Recorrência do Mensal: uma recorrência forjada faria renovação alheia virar
// acesso de quem forjou; uma cancelada à força liberaria assinatura em dobro.
caso("anônimo não cria recorrência", async () => {
  const { status } = await inserir("recorrencias", {
    user_id: "00000000-0000-0000-0000-000000000000",
    plano: "mensal",
    ambiente: "sandbox",
    asaas_assinatura_id: "sub_fronteira_teste",
  });
  if (status < 400) throw new Error(`insert aceito (HTTP ${status})`);
});

for (const [funcao, args] of [
  ["registrar_cobranca_da_assinatura", { p_pagamento_id: "pay_fronteira_teste", p_assinatura_id: "sub_fronteira_teste", p_valor: 15, p_url: "https://exemplo.invalido" }],
  ["encerrar_recorrencia", { p_assinatura_id: "sub_fronteira_teste" }],
  ["cobranca_local", { p_pagamento_id: "pay_fronteira_teste" }],
  ["recorrencias_a_reconciliar", { p_ambiente: "producao" }],
  ["destinatarios_fatura", { p_ambiente: "producao" }],
]) {
  caso(`${funcao} exige o segredo do banco`, async () => {
    const { corpo } = await chamar(funcao, { p_segredo: "segredo-errado", ...args });
    if (!/segredo inválido/.test(corpo)) {
      throw new Error(`resposta inesperada: ${corpo.slice(0, 120)}`);
    }
  });
}

caso("anônimo não cancela recorrência de ninguém", async () => {
  const { corpo } = await chamar("cancelar_minha_recorrencia", {
    p_assinatura_id: "sub_fronteira_teste",
  });
  if (corpo.trim() === "true") throw new Error("cancelou");
});

caso("anônimo não abre tópico no fórum", async () => {
  const { corpo } = await chamar("criar_topico", {
    p_titulo: "Tópico de teste da fronteira",
    p_corpo: "Não deveria existir depois desta chamada.",
    p_disciplina: null,
  });
  if (!/não autorizado/.test(corpo)) {
    throw new Error(`resposta inesperada: ${corpo.slice(0, 120)}`);
  }
});

caso("o filtro de linguagem está de pé", async () => {
  // Chamado como anônimo: a recusa por autorização vem antes, então o que se
  // afirma aqui é que a função existe e não devolve id nenhum.
  const { corpo } = await chamar("criar_topico", {
    p_titulo: "Título qualquer para o teste",
    p_corpo: "que p0rra de prova foi essa",
    p_disciplina: null,
  });
  if (/^"[0-9a-f-]{36}"$/.test(corpo.trim())) {
    throw new Error("criou tópico");
  }
});

caso("anônimo não é admin", async () => {
  const { corpo } = await chamar("sou_admin", {});
  if (corpo.trim() !== "false") {
    throw new Error(`resposta inesperada: ${corpo.slice(0, 80)}`);
  }
});

for (const funcao of ["metricas_admin", "usuarios_admin"]) {
  caso(`${funcao} recusa quem não é admin`, async () => {
    const { corpo } = await chamar(funcao, {});
    if (/"contas"|"email"/.test(corpo)) {
      throw new Error("devolveu dado de operação");
    }
  });
}

caso("anônimo não é editor", async () => {
  const { corpo } = await chamar("sou_editor", {});
  if (corpo.trim() !== "false") {
    throw new Error(`resposta inesperada: ${corpo.slice(0, 80)}`);
  }
});

for (const funcao of ["fila_de_revisao", "revisao_pendente"]) {
  caso(`${funcao} recusa quem não é editor`, async () => {
    const { corpo } = await chamar(funcao, {});
    if (/"enunciado"|"pendentes"/.test(corpo)) {
      throw new Error("devolveu dado de revisão");
    }
  });
}

caso("publicar_comentario recusa quem não é editor", async () => {
  const { corpo } = await chamar("publicar_comentario", {
    p_artigo: "00000000-0000-0000-0000-000000000000",
    p_comentario: ["texto forjado"],
    p_indexavel: true,
  });
  if (!/não autorizado/.test(corpo)) {
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
