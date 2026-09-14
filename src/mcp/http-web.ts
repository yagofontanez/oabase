import { createMcpHandler, type AuthInfo } from "@modelcontextprotocol/server";
import {
  clienteMcp,
  configuracaoSupabase,
  contextoComToken,
} from "./contexto";
import { criarServidorMcp } from "./servidor";

function inteiroPositivo(valor: string | undefined, padrao: number, maximo: number) {
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero > 0 && numero <= maximo
    ? numero
    : padrao;
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oabase.com.br";
const URL_MCP = new URL(process.env.MCP_PUBLIC_URL ?? "/api/mcp", SITE);
const MAX_CORPO = inteiroPositivo(process.env.MCP_MAX_BODY_BYTES, 1_048_576, 10_485_760);
const LIMITE_POR_MINUTO = inteiroPositivo(process.env.MCP_RATE_LIMIT, 60, 10_000);

type Janela = { inicio: number; chamadas: number };
const janelas = new Map<string, Janela>();
let ultimaLimpeza = Date.now();

function criarHandler() {
  return createMcpHandler(({ authInfo }) => {
    const userId = authInfo?.extra?.userId;
    if (!authInfo?.token || typeof userId !== "string") {
      throw new Error("Contexto autenticado ausente.");
    }
    return criarServidorMcp({
      supabase: clienteMcp(authInfo.token),
      usuario: { id: userId },
      transporte: "http",
    });
  }, {
    // A Netlify cria uma instância por requisição. As ferramentas atuais
    // encerram com uma resposta JSON; streams contínuos são recusados abaixo.
    responseMode: "auto",
    keepAliveMs: 0,
    onerror: (error) =>
      console.error(JSON.stringify({ nivel: "erro", camada: "mcp_web", erro: error.name })),
  });
}

function json(status: number, corpo: unknown, headers: HeadersInit = {}) {
  return Response.json(corpo, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function tokenBearer(request: Request) {
  const correspondencia = /^Bearer\s+([^\s]+)$/i.exec(
    request.headers.get("authorization")?.trim() ?? "",
  );
  return correspondencia?.[1];
}

function origemPermitida(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const permitidas = new Set(
    (process.env.MCP_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  return permitidas.has(origin) ? origin : false;
}

function headersCors(origin: string | null): Record<string, string> {
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Expose-Headers": "Mcp-Session-Id, Retry-After",
        Vary: "Origin",
      }
    : {};
}

function consumirLimite(chave: string, quantidade: number) {
  const agora = Date.now();
  if (agora - ultimaLimpeza >= 60_000) {
    for (const [identidade, janela] of janelas) {
      if (agora - janela.inicio >= 60_000) janelas.delete(identidade);
    }
    ultimaLimpeza = agora;
  }
  const atual = janelas.get(chave);
  if (!atual || agora - atual.inicio >= 60_000) {
    janelas.set(chave, { inicio: agora, chamadas: quantidade });
    return { permitido: quantidade <= LIMITE_POR_MINUTO, retryAfter: 60 };
  }
  atual.chamadas += quantidade;
  return {
    permitido: atual.chamadas <= LIMITE_POR_MINUTO,
    retryAfter: Math.max(1, Math.ceil((60_000 - agora + atual.inicio) / 1_000)),
  };
}

function quantidadeDeChamadas(corpo: unknown) {
  const mensagens = Array.isArray(corpo) ? corpo : [corpo];
  return Math.max(1, mensagens.filter((mensagem) =>
    mensagem && typeof mensagem === "object" &&
    (mensagem as { method?: unknown }).method === "tools/call").length);
}

function pedeStreamContinuo(corpo: unknown) {
  const mensagens = Array.isArray(corpo) ? corpo : [corpo];
  return mensagens.some((mensagem) =>
    mensagem && typeof mensagem === "object" &&
    (mensagem as { method?: unknown }).method === "subscriptions/listen");
}

export function metadadosOAuth() {
  const supabase = configuracaoSupabase();
  return {
    resource: URL_MCP.toString(),
    authorization_servers: [`${supabase.url}/auth/v1`],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid", "profile", "email"],
    resource_documentation: new URL("/mcp", SITE).toString(),
  };
}

export async function responderMetadadosMcp(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" },
    });
  }
  if (request.method !== "GET") return json(405, { erro: "Método não permitido." });
  return json(200, metadadosOAuth(), { "Access-Control-Allow-Origin": "*" });
}

export async function responderMcp(request: Request) {
  const inicio = performance.now();
  const requestId = crypto.randomUUID();
  let status = 500;
  try {
    // A Netlify já restringe os hosts associados ao site e pode reescrever o
    // host interno do Request. URLs OAuth nunca são montadas a partir dele.
    const origem = origemPermitida(request);
    if (origem === false) {
      status = 403;
      return json(status, { erro: "Origem não permitida." });
    }
    const cors = headersCors(origem);
    if (request.method === "OPTIONS") {
      status = 204;
      return new Response(null, { status, headers: cors });
    }

    const token = tokenBearer(request);
    const metadata = new URL("/.well-known/oauth-protected-resource/api/mcp", SITE);
    if (!token) {
      status = 401;
      return json(status, { erro: "Autenticação necessária." }, {
        ...cors,
        "WWW-Authenticate": `Bearer resource_metadata="${metadata.toString()}"`,
      });
    }

    let contexto;
    try {
      contexto = await contextoComToken(token, "http");
    } catch {
      status = 401;
      return json(status, { erro: "Token inválido ou expirado." }, {
        ...cors,
        "WWW-Authenticate": `Bearer error="invalid_token", resource_metadata="${metadata.toString()}"`,
      });
    }

    let corpo: unknown;
    if (request.method === "POST") {
      const bytes = await request.clone().arrayBuffer();
      if (bytes.byteLength > MAX_CORPO) {
        status = 413;
        return json(status, { erro: "Requisição grande demais." }, cors);
      }
      try {
        corpo = bytes.byteLength ? JSON.parse(new TextDecoder().decode(bytes)) : undefined;
      } catch {
        status = 400;
        return json(status, { erro: "JSON inválido." }, cors);
      }
      if (pedeStreamContinuo(corpo)) {
        status = 501;
        return json(status, {
          erro: "Este endpoint serverless não mantém assinaturas contínuas.",
        }, cors);
      }
    }

    const limite = consumirLimite(contexto.usuario!.id, quantidadeDeChamadas(corpo));
    if (!limite.permitido) {
      status = 429;
      return json(status, { erro: "Muitas chamadas. Aguarde antes de tentar novamente." }, {
        ...cors,
        "Retry-After": String(limite.retryAfter),
      });
    }

    const { data: claims } = await contexto.supabase.auth.getClaims(token);
    const authInfo: AuthInfo = {
      token,
      clientId: typeof claims?.claims?.client_id === "string"
        ? claims.claims.client_id
        : contexto.usuario!.id,
      scopes: typeof claims?.claims?.scope === "string"
        ? claims.claims.scope.split(" ").filter(Boolean)
        : [],
      expiresAt: typeof claims?.claims?.exp === "number" ? claims.claims.exp : undefined,
      resource: URL_MCP,
      extra: { userId: contexto.usuario!.id },
    };
    const handler = criarHandler();
    let resposta: Response;
    let respostaCompleta: ArrayBuffer;
    try {
      resposta = await handler.fetch(request, { authInfo, parsedBody: corpo });
      respostaCompleta = await resposta.arrayBuffer();
    } finally {
      await handler.close();
    }
    status = resposta.status;
    const headers = new Headers(resposta.headers);
    for (const [nome, valor] of Object.entries(cors)) headers.set(nome, valor);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Request-Id", requestId);
    return new Response(respostaCompleta, { status, statusText: resposta.statusText, headers });
  } catch (error) {
    console.error(JSON.stringify({
      nivel: "erro",
      camada: "mcp_web",
      requestId,
      erro: error instanceof Error ? error.name : "desconhecido",
    }));
    return json(500, { erro: "Falha interna.", requestId });
  } finally {
    console.error(JSON.stringify({
      nivel: "info",
      camada: "mcp_web",
      requestId,
      metodo: request.method,
      status,
      duracaoMs: Math.round(performance.now() - inicio),
    }));
  }
}
