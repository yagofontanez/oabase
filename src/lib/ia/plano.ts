/**
 * Geração do plano de estudos. **Somente servidor** — lê `GROQ_API_KEY`, que
 * não tem prefixo público e por isso nunca chega ao navegador.
 *
 * A regra que organiza este arquivo: **o modelo planeja tempo, não ensina
 * Direito.** Ele recebe a lista de disciplinas do banco e devolve uma
 * distribuição de horas; nenhuma afirmação jurídica sai daqui. Um aluno que
 * estuda uma regra alucinada perde ponto na prova e só descobre no dia — é o
 * pior modo de falha possível numa ferramenta de estudo.
 *
 * A saída é JSON e passa por validação antes de ser gravada: disciplina que
 * não existe na tabela é descartada, hora fora de faixa é corrigida. O que o
 * modelo produz é sugestão de cronograma, e é assim que a tela apresenta.
 */

const URL_GROQ = "https://api.groq.com/openai/v1/chat/completions";
const MODELO = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

/**
 * Teto de semanas detalhadas.
 *
 * Não é só economia de tokens — embora seja também: treze semanas de blocos
 * estouraram o limite e o JSON voltou truncado. É que cronograma feito hoje
 * para a semana onze é ficção: a pessoa vai ter estudado diferente do
 * previsto muito antes disso. Melhor detalhar seis e pedir para refazer.
 */
const SEMANAS_MAXIMAS = 6;

export type BlocoDoPlano = {
  disciplina: string;
  horas: number;
  objetivo: string;
};

export type SemanaDoPlano = {
  numero: number;
  foco: string;
  blocos: BlocoDoPlano[];
};

export type Plano = {
  diagnostico: string;
  horasPorSemana: number;
  semanas: SemanaDoPlano[];
  avisos: string[];
};

export type Mensagem = { papel: "pessoa" | "assistente"; texto: string };

/** Limite de uso do provedor — distinto de erro no pedido. */
export class ErroDeLimite extends Error {
  constructor() {
    super("Limite de uso do provedor atingido.");
    this.name = "ErroDeLimite";
  }
}

export type ContextoDoPlano = {
  edicao: number;
  dataDaProva: string;
  diasRestantes: number;
  disciplinas: { nome: string; mediaPorProva: number }[];
  focoPorDisciplina: { nome: string; minutos: number }[];
  minutosUltimos14Dias: number;
};

const SISTEMA = `Você monta cronogramas de estudo para o Exame de Ordem da OAB (1ª fase, Brasil).

O QUE VOCÊ FAZ: distribuir tempo entre disciplinas ao longo das semanas que faltam, com objetivo curto por bloco.

O QUE VOCÊ NÃO FAZ, EM HIPÓTESE NENHUMA:
- afirmar conteúdo jurídico (o que diz um artigo, qual é a resposta de algo, qual é o entendimento de um tribunal);
- citar número de artigo, súmula, lei ou jurisprudência;
- inventar disciplinas fora da lista fornecida.
Se a pessoa pedir explicação de matéria, responda no campo "avisos" que o conteúdo comentado está na área de legislação do site, e siga planejando.

SEMPRE ENTREGUE UM PLANO. Nunca devolva "semanas" vazio, bloco sem disciplina
ou "horasPorSemana": 0. Nunca peça mais informação em vez de planejar — se
faltar dado, estime e registre a estimativa em "avisos".

Como estimar disponibilidade quando ela vier em palavras:
- "à noite" ≈ 2h por dia útil; "de manhã cedo" ≈ 1,5h por dia útil;
- "fim de semana" ≈ 4h por dia; "sábado" ≈ 4h; "tempo integral" ≈ 6h por dia.
Some, arredonde e escreva em "avisos" a suposição que você usou, convidando a
pessoa a corrigir.

CRITÉRIOS DE UM BOM PLANO:
- Peso: disciplina que cai mais recebe mais tempo. Cubra pelo menos as seis de
  maior peso; com muitas semanas, cubra todas.
- Ética e Estatuto tem a melhor relação entre volume cobrado e material a estudar; priorize cedo.
- Respeite as horas semanais declaradas quando houver número explícito.
- Com pouco tempo até a prova, concentre no que mais cai em vez de tentar cobrir tudo.
- Considere o histórico de foco: disciplina já muito estudada pode ceder espaço.

Responda SOMENTE JSON neste formato:
{
  "diagnostico": "2 a 3 frases, direto, em português do Brasil",
  "horasPorSemana": number,
  "semanas": [
    { "numero": 1, "foco": "título curto", "blocos": [ { "disciplina": "nome exato da lista", "horas": number, "objetivo": "frase curta sobre o que fazer" } ] }
  ],
  "avisos": ["opcional, cuidados ou respostas a pedidos fora de escopo"]
}`;

function contextoEmTexto(c: ContextoDoPlano) {
  const disciplinas = c.disciplinas
    .map((d) => `- ${d.nome} (≈${d.mediaPorProva} questões por prova)`)
    .join("\n");
  const foco =
    c.focoPorDisciplina.length > 0
      ? c.focoPorDisciplina
          .map((f) => `- ${f.nome}: ${f.minutos} min`)
          .join("\n")
      : "- ainda não há histórico de estudo registrado";

  const semanasTotais = Math.max(1, Math.ceil(c.diasRestantes / 7));
  const aDetalhar = Math.min(SEMANAS_MAXIMAS, semanasTotais);

  return `DADOS REAIS (use só estes, não invente outros):
Exame: ${c.edicao}º Exame de Ordem, 1ª fase em ${c.dataDaProva}.
Faltam ${c.diasRestantes} dias (${semanasTotais} semanas).

Detalhe exatamente ${aDetalhar} ${aDetalhar === 1 ? "semana" : "semanas"}.${
    semanasTotais > aDetalhar
      ? ` Como faltam ${semanasTotais} semanas no total, planeje as ${aDetalhar} primeiras e diga em "avisos" que o plano deve ser refeito ao fim delas.`
      : ""
  }

Disciplinas e peso na prova:
${disciplinas}

Foco registrado nos últimos 14 dias (total ${c.minutosUltimos14Dias} min):
${foco}`;
}

/** Aproxima o nome devolvido pelo modelo ao da lista real. */
function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Valida e conserta o que o modelo devolveu.
 *
 * Descarta disciplina inexistente em vez de exibi-la: um cronograma com
 * matéria que não cai na prova é pior do que um cronograma mais curto.
 */
export function validarPlano(
  bruto: unknown,
  disciplinasReais: string[],
  semanasMaximas: number,
): Plano | null {
  if (!bruto || typeof bruto !== "object") return null;
  const p = bruto as Record<string, unknown>;

  const porNome = new Map(disciplinasReais.map((d) => [normalizar(d), d]));

  const semanas: SemanaDoPlano[] = Array.isArray(p.semanas)
    ? (p.semanas as Record<string, unknown>[])
        .slice(0, semanasMaximas)
        .map((s, i) => {
          const blocos: BlocoDoPlano[] = Array.isArray(s.blocos)
            ? (s.blocos as Record<string, unknown>[])
                .map((b) => {
                  const nome = porNome.get(normalizar(String(b.disciplina ?? "")));
                  const horas = Number(b.horas);
                  if (!nome || !Number.isFinite(horas) || horas <= 0) return null;
                  return {
                    disciplina: nome,
                    horas: Math.min(60, Math.round(horas * 2) / 2),
                    objetivo: String(b.objetivo ?? "").slice(0, 220),
                  };
                })
                .filter((b): b is BlocoDoPlano => b !== null)
            : [];
          return {
            numero: i + 1,
            foco: String(s.foco ?? `Semana ${i + 1}`).slice(0, 90),
            blocos,
          };
        })
        .filter((s) => s.blocos.length > 0)
    : [];

  if (semanas.length === 0) return null;

  const horas = Number(p.horasPorSemana);
  return {
    diagnostico: String(p.diagnostico ?? "").slice(0, 600),
    horasPorSemana:
      Number.isFinite(horas) && horas > 0
        ? Math.round(horas * 2) / 2
        : Math.round(
            semanas[0].blocos.reduce((s, b) => s + b.horas, 0) * 2,
          ) / 2,
    semanas,
    avisos: Array.isArray(p.avisos)
      ? (p.avisos as unknown[]).slice(0, 4).map((a) => String(a).slice(0, 260))
      : [],
  };
}

export async function gerarPlano(
  contexto: ContextoDoPlano,
  conversa: Mensagem[],
  planoAtual: Plano | null,
): Promise<Plano> {
  const chave = process.env.GROQ_API_KEY;
  if (!chave) throw new Error("GROQ_API_KEY não configurada.");

  const mensagens: { role: string; content: string }[] = [
    { role: "system", content: SISTEMA },
    { role: "user", content: contextoEmTexto(contexto) },
  ];

  if (planoAtual) {
    mensagens.push({
      role: "assistant",
      content: JSON.stringify(planoAtual),
    });
  }

  // Só as últimas trocas: a conversa inteira encareceria a chamada sem
  // melhorar o ajuste, que depende do plano atual mais do pedido recente.
  for (const m of conversa.slice(-6)) {
    mensagens.push({
      role: m.papel === "pessoa" ? "user" : "assistant",
      content: m.texto,
    });
  }

  const resposta = await fetch(URL_GROQ, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODELO,
      messages: mensagens,
      response_format: { type: "json_object" },
      temperature: 0.4,
      // Dimensionado pelo pior caso real: seis semanas cheias saem em torno
      // de 40 blocos. Folga demais aqui não é grátis — o provedor reserva o
      // teto declarado e recusa a chamada por exceder o limite do plano.
      max_tokens: 6000,
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    // 429 e 413 são limite de uso, não defeito do pedido: a mensagem para a
    // pessoa precisa dizer "espere", e não "reescreva".
    if (resposta.status === 429 || resposta.status === 413) {
      throw new ErroDeLimite();
    }
    throw new Error(
      `Groq respondeu ${resposta.status}: ${detalhe.slice(0, 200)}`,
    );
  }

  const dados = (await resposta.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const conteudo = dados.choices?.[0]?.message?.content;
  if (!conteudo) throw new Error("Groq devolveu resposta vazia.");

  const plano = validarPlano(
    JSON.parse(conteudo),
    contexto.disciplinas.map((d) => d.nome),
    Math.min(SEMANAS_MAXIMAS, Math.max(1, Math.ceil(contexto.diasRestantes / 7))),
  );
  if (!plano) throw new Error("O plano devolvido não passou na validação.");
  return plano;
}
