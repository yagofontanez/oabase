import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createMcpHandler, type AuthInfo } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { toNodeHandler } from "@modelcontextprotocol/node";
import {
  clienteMcp,
  configuracaoSupabase,
  contextoComToken,
} from "./contexto.js";
import { criarServidorMcp } from "./servidor.js";

function inteiroPositivo(valor: string | undefined, padrao: number, maximo: number) {
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero > 0 && numero <= maximo
    ? numero
    : padrao;
}

const MAX_CORPO = inteiroPositivo(process.env.MCP_MAX_BODY_BYTES, 1_048_576, 10_485_760);
const LIMITE_POR_MINUTO = inteiroPositivo(process.env.MCP_RATE_LIMIT, 60, 10_000);

type Janela = { inicio: number; chamadas: number };
const janelas = new Map<string, Janela>();
let ultimaLimpezaDasJanelas = Date.now();

function cabecalhoUnico(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

function tokenBearer(request: IncomingMessage) {
  const valor = cabecalhoUnico(request.headers.authorization)?.trim() ?? "";
  const correspondencia = /^Bearer\s+([^\s]+)$/i.exec(valor);
  return correspondencia?.[1];
}

function origensPermitidas() {
  const configuradas =
    process.env.MCP_ALLOWED_ORIGINS ?? process.env.MCP_ALLOWED_ORIGIN ?? "";
  return new Set(
    configuradas
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function aplicarCors(
  request: IncomingMessage,
  response: ServerResponse,
  origens: Set<string>,
) {
  const origin = cabecalhoUnico(request.headers.origin);
  if (!origin) return true;
  if (!origens.has(origin)) return false;
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  );
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  response.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, Retry-After");
  return true;
}

function consumirLimite(chave: string, quantidade: number) {
  const agora = Date.now();
  if (agora - ultimaLimpezaDasJanelas >= 60_000) {
    for (const [identidade, janela] of janelas) {
      if (agora - janela.inicio >= 60_000) janelas.delete(identidade);
    }
    ultimaLimpezaDasJanelas = agora;
  }
  const atual = janelas.get(chave);
  if (!atual || agora - atual.inicio >= 60_000) {
    janelas.set(chave, { inicio: agora, chamadas: quantidade });
    return { permitido: quantidade <= LIMITE_POR_MINUTO, retryAfter: 60 };
  }
  atual.chamadas += quantidade;
  return {
    permitido: atual.chamadas <= LIMITE_POR_MINUTO,
    retryAfter: Math.max(1, Math.ceil((60_000 - (agora - atual.inicio)) / 1_000)),
  };
}

async function lerCorpo(request: IncomingMessage) {
  const pedacos: Buffer[] = [];
  let tamanho = 0;
  for await (const pedaco of request) {
    const buffer = Buffer.isBuffer(pedaco) ? pedaco : Buffer.from(pedaco);
    tamanho += buffer.length;
    if (tamanho > MAX_CORPO) throw new Error("CORPO_GRANDE");
    pedacos.push(buffer);
  }
  const texto = Buffer.concat(pedacos).toString("utf8");
  if (!texto) return undefined;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    throw new Error("JSON_INVALIDO");
  }
}

function quantidadeDeChamadas(corpo: unknown) {
  const mensagens = Array.isArray(corpo) ? corpo : [corpo];
  return Math.max(
    1,
    mensagens.filter(
      (mensagem) =>
        mensagem &&
        typeof mensagem === "object" &&
        (mensagem as { method?: unknown }).method === "tools/call",
    ).length,
  );
}

function json(response: ServerResponse, status: number, corpo: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(corpo));
}

function metadadosOAuth(urlMcp: URL, authorizationServer: string) {
  return {
    resource: urlMcp.toString(),
    authorization_servers: [authorizationServer],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid", "profile", "email"],
    resource_documentation: new URL("/mcp", process.env.NEXT_PUBLIC_SITE_URL ?? "https://oabase.com.br").toString(),
  };
}

async function iniciarHttp() {
  const supabase = configuracaoSupabase();
  const port = inteiroPositivo(process.env.MCP_PORT, 8787, 65_535);
  const host = process.env.MCP_HOST ?? "127.0.0.1";
  const urlPublica = new URL(
    process.env.MCP_PUBLIC_URL ?? `http://${host}:${port}/mcp`,
  );
  const metadataUrl = new URL(
    `/.well-known/oauth-protected-resource${urlPublica.pathname}`,
    urlPublica,
  );
  const authorizationServer = `${supabase.url}/auth/v1`;
  const origens = origensPermitidas();
  const hosts = new Set([
    urlPublica.host,
    `${host}:${port}`,
    `127.0.0.1:${port}`,
    `localhost:${port}`,
    ...(process.env.MCP_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  ]);
  const handlerMcp = createMcpHandler(({ authInfo }) => {
    const userId = authInfo?.extra?.userId;
    if (!authInfo?.token || typeof userId !== "string") {
      throw new Error("Contexto autenticado ausente.");
    }
    return criarServidorMcp({
      supabase: clienteMcp(authInfo.token),
      usuario: {
        id: userId,
        email:
          typeof authInfo.extra?.email === "string"
            ? authInfo.extra.email
            : undefined,
      },
      transporte: "http",
    });
  });
  const manipularMcp = toNodeHandler(handlerMcp, {
    onerror: (error) =>
      console.error(
        JSON.stringify({ nivel: "erro", camada: "mcp_http", erro: error.name }),
      ),
  });

  const http = createServer(async (request, response) => {
    const inicio = performance.now();
    const requestId = crypto.randomUUID();
    const caminhoDoLog = (request.url ?? "/").split("?", 1)[0];
    response.setHeader("X-Request-Id", requestId);
    try {
      const hostRecebido = cabecalhoUnico(request.headers.host) ?? "";
      if (!hosts.has(hostRecebido)) {
        json(response, 403, { erro: "Host não permitido." });
        return;
      }

      const url = new URL(request.url ?? "/", `http://${hostRecebido}`);
      const caminhosMetadata = new Set([
        "/.well-known/oauth-protected-resource",
        `/.well-known/oauth-protected-resource${urlPublica.pathname}`,
        `${urlPublica.pathname}/oauth-protected-resource`,
      ]);
      if (caminhosMetadata.has(url.pathname) && (request.method === "GET" || request.method === "OPTIONS")) {
        response.setHeader("Access-Control-Allow-Origin", "*");
        if (request.method === "OPTIONS") {
          response.writeHead(204).end();
          return;
        }
        json(response, 200, metadadosOAuth(urlPublica, authorizationServer));
        return;
      }

      if (url.pathname === "/health" && request.method === "GET") {
        json(response, 200, { status: "ok", versao: "2.0.0" });
        return;
      }
      if (url.pathname !== urlPublica.pathname) {
        json(response, 404, { erro: "Não encontrado." });
        return;
      }
      if (!aplicarCors(request, response, origens)) {
        json(response, 403, { erro: "Origem não permitida." });
        return;
      }
      if (request.method === "OPTIONS") {
        response.writeHead(204).end();
        return;
      }

      const token = tokenBearer(request);
      if (!token) {
        response.setHeader(
          "WWW-Authenticate",
          `Bearer resource_metadata="${metadataUrl.toString()}"`,
        );
        json(response, 401, { erro: "Autenticação necessária." });
        return;
      }

      let contexto;
      try {
        contexto = await contextoComToken(token, "http");
      } catch {
        response.setHeader(
          "WWW-Authenticate",
          `Bearer error="invalid_token", resource_metadata="${metadataUrl.toString()}"`,
        );
        json(response, 401, { erro: "Token inválido ou expirado." });
        return;
      }

      let corpo: unknown;
      if (request.method === "POST") {
        try {
          corpo = await lerCorpo(request);
        } catch (error) {
          const grande = error instanceof Error && error.message === "CORPO_GRANDE";
          json(response, grande ? 413 : 400, {
            erro: grande ? "Requisição grande demais." : "JSON inválido.",
          });
          return;
        }
      }

      const limite = consumirLimite(
        contexto.usuario?.id ?? request.socket.remoteAddress ?? "anonimo",
        quantidadeDeChamadas(corpo),
      );
      if (!limite.permitido) {
        response.setHeader("Retry-After", String(limite.retryAfter));
        json(response, 429, { erro: "Muitas chamadas. Aguarde antes de tentar novamente." });
        return;
      }

      const { data: claims } = await contexto.supabase.auth.getClaims(token);
      const escopos = typeof claims?.claims?.scope === "string"
        ? claims.claims.scope.split(" ").filter(Boolean)
        : [];
      (request as IncomingMessage & { auth?: AuthInfo }).auth = {
        token,
        clientId:
          typeof claims?.claims?.client_id === "string"
            ? claims.claims.client_id
            : contexto.usuario!.id,
        scopes: escopos,
        expiresAt:
          typeof claims?.claims?.exp === "number" ? claims.claims.exp : undefined,
        resource: urlPublica,
        extra: { userId: contexto.usuario!.id },
      };

      await manipularMcp(request, response, corpo);
    } catch (error) {
      console.error(
        JSON.stringify({
          nivel: "erro",
          requestId,
          erro: error instanceof Error ? error.name : "desconhecido",
        }),
      );
      if (!response.headersSent) {
        json(response, 500, { erro: "Falha interna.", requestId });
      } else if (!response.writableEnded) {
        response.end();
      }
    } finally {
      console.error(
        JSON.stringify({
          nivel: "info",
          requestId,
          metodo: request.method,
          caminho: caminhoDoLog,
          status: response.statusCode,
          duracaoMs: Math.round(performance.now() - inicio),
        }),
      );
    }
  });

  http.headersTimeout = 10_000;
  http.requestTimeout = 30_000;
  http.keepAliveTimeout = 5_000;
  http.maxRequestsPerSocket = 100;

  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(port, host, () => {
      http.off("error", reject);
      console.error(`OABase MCP HTTP ouvindo em ${urlPublica.toString()}`);
      resolve();
    });
  });

  const encerrar = (sinal: string) => {
    console.error(`Encerrando OABase MCP (${sinal}).`);
    void handlerMcp.close().finally(() => {
      http.close(() => process.exit(0));
    });
  };
  process.once("SIGINT", () => encerrar("SIGINT"));
  process.once("SIGTERM", () => encerrar("SIGTERM"));
}

async function iniciarStdio() {
  const token = process.env.OABASE_ACCESS_TOKEN?.trim();
  const contexto = await contextoComToken(token, "stdio");
  const transporte = new StdioServerTransport();
  await criarServidorMcp(contexto).connect(transporte);
  console.error(
    contexto.usuario
      ? "OABase MCP conectado via stdio com sessão do aluno."
      : "OABase MCP conectado via stdio apenas com ferramentas públicas.",
  );
}

async function iniciar() {
  if (process.env.MCP_TRANSPORT === "http") return iniciarHttp();
  return iniciarStdio();
}

void iniciar().catch((error) => {
  const mensagem = error instanceof Error && error.message === "TOKEN_INVALIDO"
    ? "OABASE_ACCESS_TOKEN inválido ou expirado."
    : "Falha ao iniciar o MCP do OABase.";
  console.error(mensagem);
  process.exitCode = 1;
});
