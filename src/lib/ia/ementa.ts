import type { Disciplina } from "@/lib/content/types";
import { ErroDeLimite, type Plano } from "@/lib/ia/plano";

const URL_GROQ = "https://api.groq.com/openai/v1/chat/completions";
const MODELO = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
const MAX_TOPICOS = 60;

export type TopicoDaEmenta = {
  titulo: string;
  disciplina: string | null;
};

export type TopicoDaProva = {
  titulo: string;
  dificuldade: 1 | 2 | 3;
  materiais: string[];
};

export type EmentaOrganizada = {
  titulo: string;
  topicos: TopicoDaEmenta[];
};

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function validarOrganizacao(
  bruto: unknown,
  disciplinas: Disciplina[],
  tituloSugerido: string,
): EmentaOrganizada | null {
  if (!bruto || typeof bruto !== "object") return null;
  const objeto = bruto as Record<string, unknown>;
  if (!Array.isArray(objeto.topicos)) return null;
  const disciplinasPorNome = new Map(
    disciplinas.map((disciplina) => [normalizar(disciplina.nome), disciplina.nome]),
  );
  const vistos = new Set<string>();
  const topicos: TopicoDaEmenta[] = [];

  for (const item of objeto.topicos.slice(0, MAX_TOPICOS)) {
    if (!item || typeof item !== "object") continue;
    const linha = item as Record<string, unknown>;
    const titulo = String(linha.titulo ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
    const chave = normalizar(titulo);
    if (titulo.length < 3 || vistos.has(chave)) continue;
    vistos.add(chave);
    const disciplinaPedida = normalizar(String(linha.disciplina ?? ""));
    topicos.push({
      titulo,
      disciplina: disciplinasPorNome.get(disciplinaPedida) ?? null,
    });
  }
  if (topicos.length === 0) return null;

  const titulo = String(tituloSugerido || objeto.titulo || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return { titulo: titulo || "Plano da disciplina", topicos };
}

/**
 * A IA funciona como indexadora: separa títulos e aproxima cada um de uma
 * disciplina existente. Ela não recebe permissão para resumir ou explicar
 * conteúdo jurídico — a revisão humana seguinte é obrigatória na interface.
 */
export async function organizarEmenta(
  texto: string,
  disciplinas: Disciplina[],
  tituloSugerido = "",
): Promise<EmentaOrganizada> {
  const chave = process.env.GROQ_API_KEY;
  if (!chave) throw new Error("GROQ_API_KEY não configurada.");
  const nomes = disciplinas.map((disciplina) => disciplina.nome).join("\n- ");
  const resposta = await fetch(URL_GROQ, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODELO,
      messages: [
        {
          role: "system",
          content: `Você organiza ementas de cursos de Direito em tópicos de estudo.

Faça somente estas tarefas:
- identifique o nome da disciplina, se estiver explícito;
- separe unidades, capítulos e assuntos em títulos curtos;
- preserve a ordem em que aparecem;
- associe cada tópico a UMA disciplina da lista permitida, somente quando houver correspondência clara;
- use null quando não houver correspondência.

Não explique Direito, não complete conteúdo ausente, não cite leis por conta própria e não crie tópicos que não estejam no texto. Remova bibliografia, critérios de avaliação, dados administrativos e repetições.

Disciplinas permitidas:
- ${nomes}

Responda somente JSON:
{"titulo":"nome curto","topicos":[{"titulo":"tópico encontrado","disciplina":"nome exato da lista ou null"}]}`,
        },
        {
          role: "user",
          content: `${tituloSugerido ? `Título informado: ${tituloSugerido}\n\n` : ""}EMENTA ENVIADA:\n${texto}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 3000,
    }),
  });
  if (!resposta.ok) {
    const detalhe = await resposta.text();
    if (resposta.status === 429 || resposta.status === 413) throw new ErroDeLimite();
    throw new Error(`Groq respondeu ${resposta.status}: ${detalhe.slice(0, 200)}`);
  }
  const dados = (await resposta.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const conteudo = dados.choices?.[0]?.message?.content;
  if (!conteudo) throw new Error("Groq devolveu resposta vazia para a ementa.");
  const organizada = validarOrganizacao(
    JSON.parse(conteudo),
    disciplinas,
    tituloSugerido,
  );
  if (!organizada) throw new Error("A ementa organizada não passou na validação.");
  return organizada;
}

export function montarPlanoDaEmenta({
  titulo,
  topicos,
  horasPorSemana,
  semanasDisponiveis,
  prazo,
}: {
  titulo: string;
  topicos: TopicoDaEmenta[];
  horasPorSemana: number;
  semanasDisponiveis: number;
  prazo: string | null;
}): Plano {
  const semanasDetalhadas = Math.max(
    1,
    Math.min(12, semanasDisponiveis, topicos.length),
  );
  const porSemana = Array.from({ length: semanasDetalhadas }, (_, indice) => {
    const inicio = Math.floor((indice * topicos.length) / semanasDetalhadas);
    const fim = Math.floor(((indice + 1) * topicos.length) / semanasDetalhadas);
    return topicos.slice(inicio, fim);
  });
  const semanas = porSemana.map((daSemana, indice) => {
    const horasBase = Math.max(
      0.01,
      Math.floor((horasPorSemana / daSemana.length) * 100) / 100,
    );
    return {
      numero: indice + 1,
      foco:
        daSemana.length === 1
          ? daSemana[0].titulo
          : `${daSemana[0].titulo} + ${daSemana.length - 1} ${daSemana.length === 2 ? "tópico" : "tópicos"}`,
      blocos: daSemana.map((topico, ordem) => ({
        disciplina: topico.disciplina ?? topico.titulo,
        horas:
          ordem === daSemana.length - 1
            ? Math.max(
                0.01,
                Math.round(
                  (horasPorSemana - horasBase * (daSemana.length - 1)) * 100,
                ) / 100,
              )
            : horasBase,
        objetivo: `Estudar “${topico.titulo}” conforme a ementa e os materiais da disciplina.`.slice(
          0,
          260,
        ),
      })),
    };
  });
  const externos = topicos.filter((topico) => !topico.disciplina).length;
  const avisos: string[] = [];
  if (externos > 0) {
    avisos.push(
      `${externos} ${externos === 1 ? "tópico não tem correspondência direta no acervo e usa" : "tópicos não têm correspondência direta no acervo e usam"} os materiais indicados pela disciplina.`,
    );
  }
  if (porSemana.some((daSemana) => daSemana.length > horasPorSemana * 4)) {
    avisos.push(
      "A carga informada deixa menos de 15 minutos para alguns tópicos. Considere aumentar as horas semanais ou reduzir a lista.",
    );
  }
  if (semanasDisponiveis > 12) {
    avisos.push(
      "As primeiras 12 semanas foram detalhadas. Refaça o plano ao final delas para adaptar o restante ao progresso real.",
    );
  }
  if (!prazo) {
    avisos.push("Nenhuma data de avaliação foi informada; o roteiro começa pelas próximas semanas.");
  }
  return {
    diagnostico: `A ementa “${titulo}” foi organizada em ${topicos.length} ${topicos.length === 1 ? "tópico" : "tópicos"}, distribuídos por ${semanas.length} ${semanas.length === 1 ? "semana" : "semanas"} com ${horasPorSemana}h semanais.`,
    horasPorSemana,
    semanas,
    avisos,
  };
}

/**
 * Roteiro regressivo para uma avaliação da faculdade. A dificuldade declarada
 * pela pessoa ordena a primeira passada (não é uma estatística da OAB) e a
 * última semana fica reservada para revisão dos tópicos já vistos.
 */
export function montarPlanoDaProva({
  disciplina,
  avaliacao,
  topicos,
  horasPorSemana,
  semanasDisponiveis,
  prazo,
}: {
  disciplina: string;
  avaliacao: string;
  topicos: TopicoDaProva[];
  horasPorSemana: number;
  semanasDisponiveis: number;
  prazo: string;
}): Plano {
  const semanasTotais = Math.max(1, Math.min(12, semanasDisponiveis));
  const temRevisao = semanasTotais > 1 && topicos.length > 1;
  const semanasDeConteudo = temRevisao ? semanasTotais - 1 : semanasTotais;
  const ordenados = [...topicos].sort((a, b) => b.dificuldade - a.dificuldade);
  const porSemana = Array.from({ length: semanasDeConteudo }, (_, indice) => {
    const inicio = Math.floor((indice * ordenados.length) / semanasDeConteudo);
    const fim = Math.floor(((indice + 1) * ordenados.length) / semanasDeConteudo);
    return ordenados.slice(inicio, fim);
  });
  const semanas = porSemana.map((daSemana, indice) => {
    const carga = Math.max(0.01, Math.floor((horasPorSemana / Math.max(1, daSemana.length)) * 100) / 100);
    return {
      numero: indice + 1,
      foco: daSemana.length === 1
        ? daSemana[0].titulo
        : `${daSemana[0]?.titulo ?? "Conteúdo da avaliação"} + ${Math.max(0, daSemana.length - 1)} tópicos`,
      blocos: daSemana.map((topico, ordem) => ({
        disciplina,
        horas: ordem === daSemana.length - 1
          ? Math.max(0.01, Math.round((horasPorSemana - carga * (daSemana.length - 1)) * 100) / 100)
          : carga,
        objetivo: `Estudar “${topico.titulo}” (dificuldade ${topico.dificuldade}/3).${topico.materiais.length ? ` Materiais: ${topico.materiais.join(", ")}.` : ""}`.slice(0, 260),
      })),
    };
  });
  if (temRevisao) {
    semanas.push({
      numero: semanasTotais,
      foco: "Revisão final e simulado da avaliação",
      blocos: [{
        disciplina,
        horas: horasPorSemana,
        objetivo: `Revisar os ${topicos.length} tópicos de “${avaliacao}”, refazer exercícios e simular a prova.`.slice(0, 260),
      }],
    });
  }
  return {
    diagnostico: `Plano regressivo para ${avaliacao || "a avaliação"}: ${topicos.length} tópicos organizados em ${semanas.length} semanas, priorizando os assuntos mais difíceis e reservando a reta final para revisão.`,
    horasPorSemana,
    semanas,
    avisos: [
      `A dificuldade foi informada por você e não representa incidência ou peso do Exame de Ordem.`,
      `A última semana concentra revisão e simulado; ajuste a carga se a avaliação exigir trabalhos ou leituras extras.`,
    ],
  };
}
