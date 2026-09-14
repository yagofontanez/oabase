import {
  McpServer,
  ResourceTemplate,
  type CallToolResult,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import type { ContextoMcp } from "./contexto.js";
import { falha, falhaDoBanco, sucesso, type ErroDoBanco } from "./respostas.js";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oabase.com.br";
const ENTRAR = new URL("/entrar", SITE).toString();
const ASSINAR = new URL("/app/assinar", SITE).toString();

const somenteLeitura = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const mutacaoIdempotente = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const mutacao = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

const saidaGenerica = z.object({
  ok: z.literal(true),
  dados: z.record(z.string(), z.unknown()),
});

const termoBusca = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((termo) => termo.length >= 2 || /^\d$/.test(termo), {
    message: "Use pelo menos duas letras; um dígito isolado também é válido.",
  });

type LinhaBusca = {
  tipo?: string;
  id?: string;
  rotulo?: string;
  resumo?: string;
  href?: string;
  comentado?: boolean;
};

type LinhaRoadmap = {
  id: string;
  semana: number;
  ordem: number;
  disciplina: string;
  objetivo: string;
  horas: number | string;
  estado: string;
  anotacao?: string | null;
  data_planejada?: string | null;
  horario_planejado?: string | null;
};

function urlAbsoluta(path: string | undefined) {
  return path ? new URL(path, SITE).toString() : null;
}

function comoObjeto(valor: unknown): Record<string, unknown> {
  if (valor && typeof valor === "object" && !Array.isArray(valor)) {
    return valor as Record<string, unknown>;
  }
  return { valor };
}

function erroBanco(error: unknown): ErroDoBanco {
  const e = error as { code?: unknown; message?: unknown } | null;
  return {
    code: typeof e?.code === "string" ? e.code : undefined,
    message: typeof e?.message === "string" ? e.message : "Erro desconhecido",
  };
}

async function executar(
  ferramenta: string,
  tarefa: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  const inicio = performance.now();
  let status = "ok";
  try {
    const resposta = await tarefa();
    if (resposta.isError) status = "erro_controlado";
    return resposta;
  } catch (error) {
    status = "erro_interno";
    console.error(
      JSON.stringify({
        nivel: "erro",
        ferramenta,
        erro: error instanceof Error ? error.name : "desconhecido",
      }),
    );
    return falha(
      "INTERNAL_ERROR",
      "O OABase não conseguiu concluir esta ação. Tente novamente.",
      { retryable: true },
    );
  } finally {
    console.error(
      JSON.stringify({
        nivel: "info",
        ferramenta,
        status,
        duracaoMs: Math.round(performance.now() - inicio),
      }),
    );
  }
}

function exigirUsuario(contexto: ContextoMcp): CallToolResult | null {
  return contexto.usuario
    ? null
    : falha("AUTH_REQUIRED", "Conecte sua conta do OABase para continuar.", {
        actionUrl: ENTRAR,
      });
}

function criarVerificadorDeAssinatura(contexto: ContextoMcp) {
  let verificacao:
    | Promise<{ ativa: boolean; error: ErroDoBanco | null }>
    | undefined;

  return async (): Promise<CallToolResult | null> => {
    const semUsuario = exigirUsuario(contexto);
    if (semUsuario) return semUsuario;

    verificacao ??= (async () => {
      const { data, error } = await contexto.supabase
        .from("assinaturas")
        .select("id")
        .eq("status", "ativa")
        .gt("fim", new Date().toISOString())
        .limit(1);
      return {
        ativa: Boolean(data?.length),
        error: error ? erroBanco(error) : null,
      };
    })();

    const { ativa, error } = await verificacao;
    if (error) return falhaDoBanco(error, "verificar_assinatura");
    return ativa
      ? null
      : falha(
          "SUBSCRIPTION_REQUIRED",
          "Esta ferramenta exige uma assinatura ativa do OABase.",
          { actionUrl: ASSINAR },
        );
  };
}

function linksDeBusca(itens: LinhaBusca[]): CallToolResult["content"] {
  return itens.flatMap((item) => {
    const href = urlAbsoluta(item.href);
    if (!href) return [];
    const partes = new URL(href).pathname.split("/").filter(Boolean);
    const uri = partes[0] === "legislacao" && partes.length >= 3
      ? `oabase://legislacao/${partes[1]}/${partes[2]}`
      : partes[0] === "sumulas" && partes.length >= 2
        ? `oabase://sumulas/${partes[1]}`
        : href;
    return [
      {
        type: "resource_link" as const,
        uri,
        name: item.rotulo ?? "Fonte jurídica",
        description: item.resumo,
        mimeType: uri.startsWith("oabase://") ? "application/json" : "text/html",
      },
    ];
  });
}

function normalizarBusca(data: unknown) {
  return (Array.isArray(data) ? data : []).map((item) => {
    const linha = item as LinhaBusca;
    return { ...linha, url: urlAbsoluta(linha.href) };
  });
}

function hojeNoBrasil() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const obter = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${obter("year")}-${obter("month")}-${obter("day")}`;
}

function segundaFeiraAtual() {
  const [ano, mes, dia] = hojeNoBrasil().split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() - ((data.getUTCDay() + 6) % 7));
  return data.toISOString().slice(0, 10);
}

function textoDaVariavel(valor: string | string[]) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor;
}

export function criarServidorMcp(contexto: ContextoMcp) {
  const server = new McpServer(
    { name: "oabase-estudos", version: "2.0.0" },
    {
      instructions:
        "Você é um assistente de estudos em Direito conectado ao OABase. Consulte as ferramentas antes de afirmar conteúdo jurídico, cite as URLs devolvidas e diferencie texto oficial, comentário autoral e sugestão. Nunca invente doutrina, jurisprudência ou gabarito. Não peça tokens no prompt. Para qualquer escrita, explique brevemente ao aluno o que será registrado.",
    },
  );
  const exigirAssinatura = criarVerificadorDeAssinatura(contexto);

  server.registerTool(
    "buscar_legislacao",
    {
      title: "Buscar legislação",
      description: "Busca artigos e súmulas oficiais por texto ou número. Cite a URL canônica de cada dispositivo utilizado.",
      inputSchema: z.object({
        termo: termoBusca.describe("Texto, artigo ou número procurado"),
        lei_slug: z.string().trim().max(100).optional(),
        limite: z.number().int().min(1).max(20).default(10),
      }),
      outputSchema: saidaGenerica,
      annotations: somenteLeitura,
    },
    (entrada) => executar("buscar_legislacao", async () => {
      const { data, error } = await contexto.supabase.rpc("buscar_dispositivos", {
        termo: entrada.termo,
        lei_slug: entrada.lei_slug ?? null,
        limite: entrada.limite,
      });
      if (error) return falhaDoBanco(erroBanco(error), "buscar_legislacao");
      const itens = normalizarBusca(data);
      return sucesso({ ok: true, dados: { itens, total: itens.length } }, linksDeBusca(itens));
    }),
  );

  server.registerTool(
    "buscar_sumulas",
    {
      title: "Buscar súmulas",
      description: "Busca exclusivamente súmulas oficiais; o filtro é aplicado antes do limite de resultados.",
      inputSchema: z.object({
        termo: termoBusca,
        limite: z.number().int().min(1).max(20).default(10),
      }),
      outputSchema: saidaGenerica,
      annotations: somenteLeitura,
    },
    (entrada) => executar("buscar_sumulas", async () => {
      const { data, error } = await contexto.supabase.rpc("buscar_sumulas", {
        termo: entrada.termo,
        limite: entrada.limite,
      });
      if (error) return falhaDoBanco(erroBanco(error), "buscar_sumulas");
      const itens = normalizarBusca(data);
      return sucesso({ ok: true, dados: { itens, total: itens.length } }, linksDeBusca(itens));
    }),
  );

  server.registerTool(
    "buscar_questoes",
    {
      title: "Buscar questões para resolver",
      description: "Monta uma fila sem revelar o gabarito. Exige conta conectada e assinatura ativa.",
      inputSchema: z.object({
        modo: z.enum(["novas", "erros", "revisao"]).default("novas"),
        exame: z.string().trim().max(100).optional(),
        disciplina: z.string().trim().max(100).optional(),
        limite: z.number().int().min(1).max(20).default(5),
      }),
      outputSchema: saidaGenerica,
      annotations: somenteLeitura,
    },
    (entrada) => executar("buscar_questoes", async () => {
      const acesso = await exigirAssinatura();
      if (acesso) return acesso;
      const { data, error } = await contexto.supabase.rpc("fila_de_questoes", {
        p_modo: entrada.modo,
        p_exame: entrada.exame ?? null,
        p_disciplina: entrada.disciplina ?? null,
        p_limite: entrada.limite,
      });
      if (error) return falhaDoBanco(erroBanco(error), "buscar_questoes");
      const itens = Array.isArray(data) ? data : [];
      return sucesso({ ok: true, dados: { itens, total: itens.length } });
    }),
  );

  server.registerTool(
    "explicar_questao",
    {
      title: "Explicar questão já respondida",
      description: "Devolve o comentário autoral somente depois de confirmar que o próprio aluno já respondeu à questão.",
      inputSchema: z.object({ questao_id: z.string().uuid() }),
      outputSchema: saidaGenerica,
      annotations: somenteLeitura,
    },
    ({ questao_id }) => executar("explicar_questao", async () => {
      const acesso = await exigirAssinatura();
      if (acesso) return acesso;
      const client = contexto.supabase;
      const { data: tentativa, error: erroTentativa } = await client
        .from("respostas")
        .select("id, respondido_em")
        .eq("questao_id", questao_id)
        .order("respondido_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (erroTentativa) return falhaDoBanco(erroBanco(erroTentativa), "explicar_questao_tentativa");
      if (!tentativa) return falha("PRECONDITION_REQUIRED", "Responda à questão antes de solicitar o comentário.");

      const [{ data: questao, error: erroQuestao }, { data: comentario, error: erroComentario }] = await Promise.all([
        client.from("questoes").select("id, numero, enunciado, alternativas").eq("id", questao_id).maybeSingle(),
        client.from("comentarios").select("corpo").eq("questao_id", questao_id).eq("status", "publicado").maybeSingle(),
      ]);
      if (erroQuestao || erroComentario) return falhaDoBanco(erroBanco(erroQuestao ?? erroComentario), "explicar_questao");
      if (!questao) return falha("NOT_FOUND", "Questão não encontrada ou sem acesso.");
      return sucesso({
        ok: true,
        dados: {
          questao,
          comentario: comentario?.corpo ?? null,
          aviso: comentario ? null : "Esta questão ainda não tem comentário autoral publicado.",
        },
      });
    }),
  );

  server.registerTool(
    "registrar_resposta",
    {
      title: "Responder questão",
      description: "Registra uma alternativa uma única vez por chave de idempotência. O gabarito aparece somente depois do registro.",
      inputSchema: z.object({
        questao_id: z.string().uuid(),
        alternativa: z.enum(["A", "B", "C", "D"]),
        tempo_ms: z.number().int().min(0).max(3_600_000).optional(),
        idempotency_key: z.string().uuid().describe("UUID novo para esta tentativa; reutilize-o ao repetir a mesma chamada"),
      }),
      outputSchema: saidaGenerica,
      annotations: mutacaoIdempotente,
    },
    (entrada) => executar("registrar_resposta", async () => {
      const acesso = await exigirAssinatura();
      if (acesso) return acesso;
      const { data, error } = await contexto.supabase.rpc("registrar_resposta_mcp", {
        p_questao_id: entrada.questao_id,
        p_alternativa: entrada.alternativa,
        p_tempo_ms: entrada.tempo_ms ?? null,
        p_idempotency_key: entrada.idempotency_key,
      });
      if (error) return falhaDoBanco(erroBanco(error), "registrar_resposta");
      return sucesso({ ok: true, dados: { resultado: Array.isArray(data) ? data[0] ?? null : data } });
    }),
  );

  server.registerTool(
    "ver_meu_progresso",
    {
      title: "Ver meu progresso",
      description: "Mostra questões respondidas, acertos, erros e revisões vencidas do próprio aluno.",
      inputSchema: z.object({}),
      outputSchema: saidaGenerica,
      annotations: somenteLeitura,
    },
    () => executar("ver_meu_progresso", async () => {
      const acesso = exigirUsuario(contexto);
      if (acesso) return acesso;
      const { data, error } = await contexto.supabase.rpc("meu_desempenho");
      if (error) return falhaDoBanco(erroBanco(error), "ver_meu_progresso");
      return sucesso({ ok: true, dados: { progresso: Array.isArray(data) ? data[0] ?? null : data } });
    }),
  );

  server.registerTool(
    "consultar_roadmap",
    {
      title: "Consultar roadmap",
      description: "Consulta blocos e metas do roadmap vigente, com datas e progresso real.",
      inputSchema: z.object({
        semana: z.number().int().min(1).max(104).optional(),
        estado: z.enum(["a_estudar", "em_andamento", "concluido"]).optional(),
        limite: z.number().int().min(1).max(100).default(40),
      }),
      outputSchema: saidaGenerica,
      annotations: somenteLeitura,
    },
    (entrada) => executar("consultar_roadmap", async () => {
      const acesso = exigirUsuario(contexto);
      if (acesso) return acesso;
      const { data: plano, error: erroPlano } = await contexto.supabase
        .from("planos_estudo")
        .select("versao_roadmap, contexto")
        .maybeSingle();
      if (erroPlano) return falhaDoBanco(erroBanco(erroPlano), "consultar_roadmap_plano");
      if (!plano?.versao_roadmap) return sucesso({ ok: true, dados: { plano: null, blocos: [], aviso: "Ainda não há roadmap." } });

      let consulta = contexto.supabase
        .from("roadmap_itens")
        .select("id, semana, ordem, disciplina, objetivo, horas, estado, anotacao, data_planejada, horario_planejado")
        .eq("versao", plano.versao_roadmap)
        .order("semana")
        .order("ordem")
        .limit(entrada.limite);
      if (entrada.semana) consulta = consulta.eq("semana", entrada.semana);
      if (entrada.estado) consulta = consulta.eq("estado", entrada.estado);
      const [blocosRes, metasRes] = await Promise.all([
        consulta,
        contexto.supabase.rpc("metas_do_roadmap", { p_versao: plano.versao_roadmap }),
      ]);
      if (blocosRes.error || metasRes.error) return falhaDoBanco(erroBanco(blocosRes.error ?? metasRes.error), "consultar_roadmap");

      const metasPorBloco = new Map<string, unknown[]>();
      for (const meta of Array.isArray(metasRes.data) ? metasRes.data : []) {
        const id = (meta as { roadmap_item_id?: string }).roadmap_item_id;
        if (!id) continue;
        metasPorBloco.set(id, [...(metasPorBloco.get(id) ?? []), meta]);
      }
      const blocos = ((blocosRes.data ?? []) as LinhaRoadmap[]).map((bloco) => ({
        ...bloco,
        metas: metasPorBloco.get(bloco.id) ?? [],
        urlSessao: new URL(`/app/sessao/${bloco.id}`, SITE).toString(),
      }));
      return sucesso({ ok: true, dados: { versao: plano.versao_roadmap, contexto: plano.contexto, blocos, total: blocos.length } });
    }),
  );

  const prepararSessao = (entrada: { minutos: number; disciplina?: string; incluir_revisoes: boolean }) =>
    executar("preparar_sessao_de_estudo", async () => {
      const acesso = await exigirAssinatura();
      if (acesso) return acesso;
      const { data: plano, error: erroPlano } = await contexto.supabase
        .from("planos_estudo")
        .select("versao_roadmap, contexto")
        .maybeSingle();
      if (erroPlano) return falhaDoBanco(erroBanco(erroPlano), "preparar_sessao_plano");
      if (!plano?.versao_roadmap) return sucesso({ ok: true, dados: { plano: null, aviso: "Crie um roadmap antes de preparar uma sessão." } });

      let consulta = contexto.supabase
        .from("roadmap_itens")
        .select("id, semana, ordem, disciplina, objetivo, horas, estado, anotacao, data_planejada, horario_planejado")
        .eq("versao", plano.versao_roadmap)
        .neq("estado", "concluido")
        .order("data_planejada", { ascending: true, nullsFirst: false })
        .order("semana")
        .order("ordem")
        .limit(12);
      if (entrada.disciplina) consulta = consulta.ilike("disciplina", `%${entrada.disciplina}%`);

      const [blocosRes, revisoesRes, flashcardsRes] = await Promise.all([
        consulta,
        entrada.incluir_revisoes
          ? contexto.supabase.from("revisoes").select("questao_id", { count: "exact", head: true }).lte("proxima_em", hojeNoBrasil())
          : Promise.resolve({ count: 0, error: null }),
        entrada.incluir_revisoes
          ? contexto.supabase.rpc("listar_meus_flashcards")
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (blocosRes.error || revisoesRes.error || flashcardsRes.error) {
        return falhaDoBanco(erroBanco(blocosRes.error ?? revisoesRes.error ?? flashcardsRes.error), "preparar_sessao");
      }
      const bloco = ((blocosRes.data ?? []) as LinhaRoadmap[])[0] ?? null;
      if (!bloco) return sucesso({ ok: true, dados: { bloco: null, aviso: "Não há bloco pendente com esse filtro." } });

      const hoje = hojeNoBrasil();
      const cardsVencidos = (Array.isArray(flashcardsRes.data) ? flashcardsRes.data : []).filter((item) => {
        const linha = item as { suspenso?: boolean; proxima_revisao?: string };
        return !linha.suspenso && Boolean(linha.proxima_revisao && linha.proxima_revisao <= hoje);
      }).length;
      const totalRevisoes = (revisoesRes.count ?? 0) + cardsVencidos;
      const minutosRevisao = entrada.incluir_revisoes && totalRevisoes > 0
        ? Math.min(Math.max(5, totalRevisoes * 2), Math.floor(entrada.minutos * 0.35))
        : 0;
      const { data: metas, error: erroMetas } = await contexto.supabase.rpc("metas_do_bloco", { p_roadmap_item_id: bloco.id });
      if (erroMetas) return falhaDoBanco(erroBanco(erroMetas), "preparar_sessao_metas");
      return sucesso({
        ok: true,
        dados: {
          minutosDisponiveis: entrada.minutos,
          agenda: { revisao: minutosRevisao, bloco: entrada.minutos - minutosRevisao },
          revisoesVencidas: { questoes: revisoesRes.count ?? 0, flashcards: cardsVencidos },
          bloco: {
            ...bloco,
            minutosPlanejadosNoRoadmap: Math.round(Number(bloco.horas) * 60),
            metas: metas ?? [],
            urlSessao: new URL(`/app/sessao/${bloco.id}`, SITE).toString(),
          },
        },
      });
    });

  const configuracaoPreparar = {
    title: "Preparar sessão de estudo",
    description: "Monta uma sessão para o tempo disponível, combinando revisões vencidas, próximo bloco e metas.",
    inputSchema: z.object({
      minutos: z.number().int().min(10).max(360).default(40),
      disciplina: z.string().trim().max(100).optional(),
      incluir_revisoes: z.boolean().default(true),
    }),
    outputSchema: saidaGenerica,
    annotations: somenteLeitura,
  };
  server.registerTool("preparar_sessao_de_estudo", configuracaoPreparar, prepararSessao);
  server.registerTool(
    "o_que_estudar_agora",
    { ...configuracaoPreparar, title: "O que estudar agora", description: "Compatibilidade: prepara a próxima sessão para o tempo disponível." },
    prepararSessao,
  );

  server.registerTool(
    "abrir_sessao_de_estudo",
    {
      title: "Abrir sessão guiada",
      description: "Abre ou recupera uma sessão de foco ligada a um bloco do roadmap.",
      inputSchema: z.object({
        roadmap_item_id: z.string().uuid(),
        minutos: z.number().int().min(5).max(360),
        modo: z.enum(["continuo", "pomodoro"]).default("pomodoro"),
        questoes: z.array(z.string().uuid()).max(20).default([]),
        materiais: z.array(z.string().trim().max(200)).max(20).default([]),
      }),
      outputSchema: saidaGenerica,
      annotations: mutacaoIdempotente,
    },
    (entrada) => executar("abrir_sessao_de_estudo", async () => {
      const acesso = await exigirAssinatura();
      if (acesso) return acesso;
      const { data, error } = await contexto.supabase.rpc("iniciar_sessao_estudo", {
        p_roadmap_item_id: entrada.roadmap_item_id,
        p_minutos: entrada.minutos,
        p_modo: entrada.modo,
        p_questoes: entrada.questoes,
        p_materiais: entrada.materiais,
      });
      if (error) return falhaDoBanco(erroBanco(error), "abrir_sessao_de_estudo");
      return sucesso({ ok: true, dados: { sessaoId: data } });
    }),
  );

  const camposSessao = {
    sessao_id: z.string().uuid(),
    segundos: z.number().int().min(0).max(43_200),
    modo: z.enum(["continuo", "pomodoro"]).default("pomodoro"),
    questoes: z.array(z.string().uuid()).max(20).default([]),
    materiais_lidos: z.array(z.string().trim().max(200)).max(20).default([]),
    checklist: z.record(z.string().max(80), z.boolean()).default({}),
    anotacao: z.string().max(4_000).default(""),
  };

  server.registerTool(
    "salvar_sessao_de_estudo",
    {
      title: "Salvar sessão guiada",
      description: "Salva o andamento de uma sessão sem encerrá-la.",
      inputSchema: z.object(camposSessao),
      outputSchema: saidaGenerica,
      annotations: mutacaoIdempotente,
    },
    (entrada) => executar("salvar_sessao_de_estudo", async () => {
      const acesso = await exigirAssinatura();
      if (acesso) return acesso;
      const { error } = await contexto.supabase.rpc("salvar_sessao_estudo", {
        p_sessao_id: entrada.sessao_id,
        p_segundos: entrada.segundos,
        p_modo: entrada.modo,
        p_questoes: entrada.questoes,
        p_materiais_lidos: entrada.materiais_lidos,
        p_checklist: entrada.checklist,
        p_anotacao: entrada.anotacao,
      });
      if (error) return falhaDoBanco(erroBanco(error), "salvar_sessao_de_estudo");
      return sucesso({ ok: true, dados: { salvo: true, sessaoId: entrada.sessao_id } });
    }),
  );

  server.registerTool(
    "encerrar_sessao_de_estudo",
    {
      title: "Encerrar sessão guiada",
      description: "Encerra a sessão, registra as evidências reais e opcionalmente conclui o bloco.",
      inputSchema: z.object({
        ...camposSessao,
        resumo: z.string().max(4_000).default(""),
        pendencias: z.string().max(4_000).default(""),
        concluir_bloco: z.boolean().default(false),
      }),
      outputSchema: saidaGenerica,
      annotations: mutacaoIdempotente,
    },
    (entrada) => executar("encerrar_sessao_de_estudo", async () => {
      const acesso = await exigirAssinatura();
      if (acesso) return acesso;
      const { data, error } = await contexto.supabase.rpc("encerrar_sessao_estudo", {
        p_sessao_id: entrada.sessao_id,
        p_segundos: entrada.segundos,
        p_modo: entrada.modo,
        p_questoes: entrada.questoes,
        p_materiais_lidos: entrada.materiais_lidos,
        p_checklist: entrada.checklist,
        p_anotacao: entrada.anotacao,
        p_resumo: entrada.resumo,
        p_pendencias: entrada.pendencias,
        p_concluir_bloco: entrada.concluir_bloco,
      });
      if (error) return falhaDoBanco(erroBanco(error), "encerrar_sessao_de_estudo");
      return sucesso({ ok: true, dados: { resultado: Array.isArray(data) ? data[0] ?? null : data } });
    }),
  );

  server.registerTool(
    "consultar_revisoes_pendentes",
    {
      title: "Consultar revisões pendentes",
      description: "Lista questões e flashcards vencidos sem alterar o calendário de revisão.",
      inputSchema: z.object({ limite: z.number().int().min(1).max(30).default(10) }),
      outputSchema: saidaGenerica,
      annotations: somenteLeitura,
    },
    ({ limite }) => executar("consultar_revisoes_pendentes", async () => {
      const acesso = await exigirAssinatura();
      if (acesso) return acesso;
      const hoje = hojeNoBrasil();
      const [questoes, flashcards] = await Promise.all([
        contexto.supabase.rpc("fila_de_questoes", { p_modo: "revisao", p_exame: null, p_disciplina: null, p_limite: limite }),
        contexto.supabase.rpc("listar_meus_flashcards"),
      ]);
      if (questoes.error || flashcards.error) return falhaDoBanco(erroBanco(questoes.error ?? flashcards.error), "consultar_revisoes_pendentes");
      const cards = (Array.isArray(flashcards.data) ? flashcards.data : [])
        .filter((item) => {
          const linha = item as { suspenso?: boolean; proxima_revisao?: string };
          return !linha.suspenso && Boolean(linha.proxima_revisao && linha.proxima_revisao <= hoje);
        })
        .slice(0, limite);
      return sucesso({ ok: true, dados: { questoes: questoes.data ?? [], flashcards: cards, dataReferencia: hoje } });
    }),
  );

  server.registerTool(
    "revisar_flashcard",
    {
      title: "Registrar revisão de flashcard",
      description: "Registra a autoavaliação do aluno e agenda a próxima revisão no banco.",
      inputSchema: z.object({
        flashcard_id: z.string().uuid(),
        avaliacao: z.enum(["errei", "dificil", "bom", "facil"]),
      }),
      outputSchema: saidaGenerica,
      annotations: mutacao,
    },
    (entrada) => executar("revisar_flashcard", async () => {
      const acesso = await exigirAssinatura();
      if (acesso) return acesso;
      const { data, error } = await contexto.supabase.rpc("revisar_flashcard", {
        p_flashcard_id: entrada.flashcard_id,
        p_avaliacao: entrada.avaliacao,
      });
      if (error) return falhaDoBanco(erroBanco(error), "revisar_flashcard");
      return sucesso({ ok: true, dados: { resultado: comoObjeto(data) } });
    }),
  );

  server.registerTool(
    "consultar_revisao_semanal",
    {
      title: "Consultar revisão semanal",
      description: "Calcula a semana a partir de fatos registrados: roadmap, foco, respostas e revisões.",
      inputSchema: z.object({ inicio_semana: z.string().date().optional() }),
      outputSchema: saidaGenerica,
      annotations: somenteLeitura,
    },
    (entrada) => executar("consultar_revisao_semanal", async () => {
      const acesso = exigirUsuario(contexto);
      if (acesso) return acesso;
      const inicio = entrada.inicio_semana ?? segundaFeiraAtual();
      const { data, error } = await contexto.supabase.rpc("minha_revisao_semanal", { p_inicio: inicio });
      if (error) return falhaDoBanco(erroBanco(error), "consultar_revisao_semanal");
      return sucesso({ ok: true, dados: { inicioSemana: inicio, revisao: comoObjeto(data) } });
    }),
  );

  registrarRecursos(server, contexto);
  registrarPrompts(server);
  return server;
}

function registrarRecursos(server: McpServer, contexto: ContextoMcp) {
  server.registerResource(
    "artigo-de-lei",
    new ResourceTemplate("oabase://legislacao/{lei_slug}/{artigo_slug}", { list: undefined }),
    { title: "Artigo de lei no OABase", description: "Texto oficial, comentário autoral e endereço canônico de um artigo.", mimeType: "application/json" },
    async (uri, variaveis) => {
      const leiSlug = textoDaVariavel(variaveis.lei_slug);
      const artigoSlug = textoDaVariavel(variaveis.artigo_slug);
      const { data, error } = await contexto.supabase
        .from("artigos")
        .select("numero, slug, caput, paragrafos, comentario, atualizado_em, leis!inner(slug, sigla, nome)")
        .eq("leis.slug", leiSlug)
        .eq("slug", artigoSlug)
        .maybeSingle();
      if (error) throw new Error("Não foi possível consultar o artigo.");
      if (!data) throw new Error("Artigo não encontrado.");
      return {
        contents: [{
          uri: uri.toString(),
          mimeType: "application/json",
          text: JSON.stringify({ ...data, url: new URL(`/legislacao/${leiSlug}/${artigoSlug}`, SITE).toString() }, null, 2),
        }],
      };
    },
  );

  server.registerResource(
    "sumula",
    new ResourceTemplate("oabase://sumulas/{slug}", { list: undefined }),
    { title: "Súmula no OABase", description: "Enunciado oficial, comentário autoral e endereço canônico de uma súmula.", mimeType: "application/json" },
    async (uri, variaveis) => {
      const slug = textoDaVariavel(variaveis.slug);
      const { data, error } = await contexto.supabase
        .from("sumulas")
        .select("slug, tribunal, numero, texto, comentario, vinculante")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error("Não foi possível consultar a súmula.");
      if (!data) throw new Error("Súmula não encontrada.");
      return {
        contents: [{
          uri: uri.toString(),
          mimeType: "application/json",
          text: JSON.stringify({ ...data, url: new URL(`/sumulas/${slug}`, SITE).toString() }, null, 2),
        }],
      };
    },
  );
}

function registrarPrompts(server: McpServer) {
  server.registerPrompt(
    "montar-sessao-de-estudo",
    {
      title: "Montar sessão de estudo",
      description: "Organiza o próximo período disponível a partir do roadmap e das revisões reais.",
      argsSchema: {
        minutos: z.string().describe("Tempo disponível em minutos"),
        disciplina: z.string().optional().describe("Disciplina preferida, se houver"),
      },
    },
    ({ minutos, disciplina }) => ({
      messages: [{
        role: "user",
        content: { type: "text", text: `Prepare uma sessão de ${minutos} minutos${disciplina ? ` para ${disciplina}` : ""}. Chame preparar_sessao_de_estudo, mostre a divisão do tempo e só use metas devolvidas pelo OABase.` },
      }],
    }),
  );

  server.registerPrompt(
    "revisar-para-prova",
    {
      title: "Revisar para uma prova",
      description: "Prioriza o estudo de uma disciplina sem pressupor que a prova seja a OAB.",
      argsSchema: {
        disciplina: z.string().describe("Disciplina ou matéria da prova"),
        data: z.string().optional().describe("Data da prova, se conhecida"),
        minutos: z.string().optional().describe("Tempo disponível agora"),
      },
    },
    ({ disciplina, data, minutos }) => ({
      messages: [{
        role: "user",
        content: { type: "text", text: `Ajude-me a revisar ${disciplina}${data ? ` para a prova de ${data}` : ""}. Tenho ${minutos ?? "40"} minutos agora. Consulte meu roadmap e as revisões; ao citar Direito, use apenas fontes devolvidas pelo OABase.` },
      }],
    }),
  );

  server.registerPrompt(
    "fechar-sessao-de-estudo",
    {
      title: "Fechar sessão de estudo",
      description: "Conduz uma síntese curta antes de registrar o encerramento da sessão.",
      argsSchema: { sessao_id: z.string().describe("ID da sessão em andamento") },
    },
    ({ sessao_id }) => ({
      messages: [{
        role: "user",
        content: { type: "text", text: `Ajude-me a fechar a sessão ${sessao_id}. Pergunte o que foi estudado, o que ficou pendente e se o bloco terminou. Só depois das respostas chame encerrar_sessao_de_estudo.` },
      }],
    }),
  );
}
