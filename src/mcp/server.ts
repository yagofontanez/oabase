import { createServer as createHttpServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * MCP do OABase — somente estudo.
 *
 * A chave anônima continua sendo a fronteira. Quando OABASE_ACCESS_TOKEN é
 * informado, o Supabase aplica a sessão do aluno e a RLS libera apenas os
 * próprios dados. Sem token, as ferramentas públicas continuam disponíveis e
 * as ferramentas pagas devolvem uma fila vazia, nunca um dado de outra conta.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TOKEN = process.env.OABASE_ACCESS_TOKEN?.trim();

if (!URL || !CHAVE_ANON) {
  throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

function supabase(): SupabaseClient {
  return createClient(URL!, CHAVE_ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(TOKEN
      ? { global: { headers: { Authorization: `Bearer ${TOKEN}` } } }
      : {}),
  });
}

function resposta(valor: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(valor, null, 2) }],
  };
}

function falha(mensagem: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: mensagem }],
  };
}

function resultado<T>(data: T, error: { message: string } | null) {
  return error ? falha(error.message) : resposta(data ?? []);
}

function criarServidor() {
  const server = new McpServer(
    { name: "oabase-estudos", version: "1.0.0" },
    {
      instructions:
        "Você é um assistente de estudos do OABase. Use as fontes e comentários devolvidos pelas ferramentas. Não invente conteúdo jurídico, não trate palpite como lei e informe quando não houver comentário publicado.",
    },
  );

  server.registerTool(
    "buscar_legislacao",
    {
      title: "Buscar legislação",
      description:
        "Busca artigos de lei e súmulas por texto ou número. É uma ferramenta pública; sempre cite o link href devolvido quando responder sobre o dispositivo.",
      inputSchema: {
        termo: z.string().min(1).max(120).describe("Texto, artigo ou número procurado"),
        lei_slug: z.string().max(100).optional().describe("Slug da lei para restringir a busca"),
        limite: z.number().int().min(1).max(20).optional().default(10),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ termo, lei_slug, limite }) => {
      const { data, error } = await supabase().rpc("buscar_dispositivos", {
        termo,
        lei_slug: lei_slug ?? null,
        limite: limite ?? 10,
      });
      return resultado(data, error);
    },
  );

  server.registerTool(
    "buscar_sumulas",
    {
      title: "Buscar súmulas",
      description: "Localiza súmulas oficiais por texto e devolve o enunciado, tribunal e endereço da fonte.",
      inputSchema: {
        termo: z.string().min(1).max(120),
        limite: z.number().int().min(1).max(20).optional().default(10),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ termo, limite }) => {
      const { data, error } = await supabase().rpc("buscar_dispositivos", {
        termo,
        lei_slug: null,
        limite: limite ?? 10,
      });
      if (error) return falha(error.message);
      return resposta((data ?? []).filter((item: { tipo?: string }) => item.tipo === "sumula"));
    },
  );

  server.registerTool(
    "buscar_questoes",
    {
      title: "Buscar questões para resolver",
      description:
        "Monta uma fila de questões sem revelar o gabarito antes da resposta. Requer sessão de assinante, conforme a mesma RLS do produto.",
      inputSchema: {
        modo: z.enum(["novas", "erros", "revisao"]).optional().default("novas"),
        exame: z.string().max(100).optional().describe("Slug do exame"),
        disciplina: z.string().max(100).optional().describe("Slug da disciplina"),
        limite: z.number().int().min(1).max(20).optional().default(5),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ modo, exame, disciplina, limite }) => {
      const { data, error } = await supabase().rpc("fila_de_questoes", {
        p_modo: modo ?? "novas",
        p_exame: exame ?? null,
        p_disciplina: disciplina ?? null,
        p_limite: limite ?? 5,
      });
      return resultado(data, error);
    },
  );

  server.registerTool(
    "explicar_questao",
    {
      title: "Explicar questão comentada",
      description:
        "Busca o comentário autoral publicado de uma questão. Se ainda não houver comentário, informa isso em vez de gerar uma explicação não revisada.",
      inputSchema: { questao_id: z.string().uuid() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ questao_id }) => {
      const client = supabase();
      const [{ data: questao, error: erroQuestao }, { data: comentario, error: erroComentario }] = await Promise.all([
        client.from("questoes").select("id, numero, enunciado, alternativas").eq("id", questao_id).maybeSingle(),
        client.from("comentarios").select("corpo, status").eq("questao_id", questao_id).eq("status", "publicado").maybeSingle(),
      ]);
      if (erroQuestao || erroComentario) return falha((erroQuestao ?? erroComentario)!.message);
      if (!questao) return falha("Questão não encontrada ou sem acesso.");
      if (!comentario) return resposta({ questao, comentario: null, aviso: "Esta questão ainda não tem comentário autoral publicado." });
      return resposta({ questao, comentario: comentario.corpo });
    },
  );

  server.registerTool(
    "registrar_resposta",
    {
      title: "Responder questão",
      description:
        "Registra a alternativa escolhida e deixa o banco comparar com o gabarito. A resposta correta só aparece depois do registro.",
      inputSchema: {
        questao_id: z.string().uuid(),
        alternativa: z.enum(["A", "B", "C", "D"]),
        tempo_ms: z.number().int().min(0).max(3_600_000).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ questao_id, alternativa, tempo_ms }) => {
      const { data, error } = await supabase().rpc("registrar_resposta", {
        p_questao_id: questao_id,
        p_alternativa: alternativa,
        p_tempo_ms: tempo_ms ?? null,
      });
      return resultado(data, error);
    },
  );

  server.registerTool(
    "ver_meu_progresso",
    {
      title: "Ver meu progresso",
      description: "Mostra somente os números do próprio aluno: questões respondidas, acertos, erros e revisões vencidas.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const { data, error } = await supabase().rpc("meu_desempenho");
      return resultado(data, error);
    },
  );

  server.registerTool(
    "o_que_estudar_agora",
    {
      title: "O que estudar agora",
      description: "Sugere o próximo bloco do roadmap pessoal e informa quantas revisões estão vencidas. Requer sessão autenticada.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const client = supabase();
      const { data: plano, error: erroPlano } = await client.from("planos_estudo").select("versao_roadmap, contexto").maybeSingle();
      if (erroPlano) return falha(erroPlano.message);
      if (!plano?.versao_roadmap) return resposta({ plano: null, aviso: "Ainda não há roadmap." });
      const [{ data: blocos, error: erroBlocos }, revisoes] = await Promise.all([
        client.from("roadmap_itens").select("id, semana, ordem, disciplina, objetivo, horas, estado, anotacao").eq("versao", plano.versao_roadmap).neq("estado", "concluido").order("semana").order("ordem").limit(3),
        client.from("revisoes").select("questao_id", { count: "exact", head: true }).lte("proxima_em", new Date().toISOString().slice(0, 10)),
      ]);
      if (erroBlocos || revisoes.error) return falha((erroBlocos ?? revisoes.error)!.message);
      return resposta({ proximoBloco: blocos?.[0] ?? null, proximosBlocos: blocos ?? [], revisoesVencidas: revisoes.count ?? 0 });
    },
  );

  server.registerTool(
    "abrir_sessao_de_estudo",
    {
      title: "Abrir sessão guiada",
      description: "Abre uma sessão de foco ligada ao bloco atual do roadmap. Requer autenticação e assinatura ativa.",
      inputSchema: {
        roadmap_item_id: z.string().uuid(),
        minutos: z.number().int().min(5).max(360),
        modo: z.enum(["continuo", "pomodoro"]).optional().default("pomodoro"),
        questoes: z.array(z.string().uuid()).max(20).optional(),
        materiais: z.array(z.string().max(200)).max(20).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ roadmap_item_id, minutos, modo, questoes, materiais }) => {
      const { data, error } = await supabase().rpc("iniciar_sessao_estudo", {
        p_roadmap_item_id: roadmap_item_id,
        p_minutos: minutos,
        p_modo: modo ?? "pomodoro",
        p_questoes: questoes ?? [],
        p_materiais: materiais ?? [],
      });
      return resultado(data, error);
    },
  );

  return server;
}

async function iniciar() {
  if (process.env.MCP_TRANSPORT === "http") {
    const port = Number(process.env.MCP_PORT ?? 8787);
    const http = createHttpServer(async (request, response) => {
      if (request.url !== "/mcp") {
        response.writeHead(404).end("Not found");
        return;
      }
      response.setHeader("Access-Control-Allow-Origin", process.env.MCP_ALLOWED_ORIGIN ?? "*");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
      if (request.method === "OPTIONS") {
        response.writeHead(204).end();
        return;
      }
      const transporte = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const server = criarServidor();
      await server.connect(transporte);
      await transporte.handleRequest(request, response);
    });
    http.listen(port, () => console.error(`OABase MCP HTTP ouvindo em :${port}/mcp`));
    return;
  }

  const transporte = new StdioServerTransport();
  await criarServidor().connect(transporte);
  console.error("OABase MCP conectado via stdio");
}

void iniciar().catch((error) => {
  console.error("Falha ao iniciar o MCP do OABase:", error);
  process.exitCode = 1;
});
