import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import test from "node:test";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContextoMcp } from "./contexto.js";
import { responderMcp } from "./http-web.js";
import { criarServidorMcp } from "./servidor.js";

type Resposta = { data: unknown; error: null };

function clienteFalso(
  aoRpc: (nome: string, parametros: Record<string, unknown> | undefined) => Resposta = () => ({ data: [], error: null }),
) {
  const corrente = {
    select: () => corrente,
    eq: () => corrente,
    gt: () => corrente,
    lte: () => corrente,
    neq: () => corrente,
    ilike: () => corrente,
    order: () => corrente,
    limit: () => corrente,
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolver: (valor: Resposta) => unknown) => resolver({ data: [], error: null }),
  };
  return {
    rpc: async (nome: string, parametros?: Record<string, unknown>) =>
      aoRpc(nome, parametros),
    from: () => corrente,
  } as unknown as SupabaseClient;
}

async function conectar(contexto: ContextoMcp) {
  const server = criarServidorMcp(contexto);
  const client = new Client({ name: "teste-oabase", version: "1.0.0" });
  const [clienteTransport, servidorTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(servidorTransport),
    client.connect(clienteTransport),
  ]);
  return {
    server,
    client,
    fechar: async () => {
      await client.close();
      await server.close();
    },
  };
}

async function portaLivre() {
  const servidor = createNetServer();
  await new Promise<void>((resolve, reject) => {
    servidor.once("error", reject);
    servidor.listen(0, "127.0.0.1", resolve);
  });
  const endereco = servidor.address();
  const porta = typeof endereco === "object" && endereco ? endereco.port : 0;
  await new Promise<void>((resolve) => servidor.close(() => resolve()));
  return porta;
}

test("publica ferramentas com schemas, resources e prompts", async () => {
  const conexao = await conectar({
    supabase: clienteFalso(),
    usuario: null,
    transporte: "teste",
  });
  try {
    const [{ tools }, { resourceTemplates }, { prompts }] = await Promise.all([
      conexao.client.listTools(),
      conexao.client.listResourceTemplates(),
      conexao.client.listPrompts(),
    ]);
    assert.ok(tools.length >= 14);
    assert.ok(tools.every((tool) => tool.outputSchema));
    assert.equal(
      tools.find((tool) => tool.name === "registrar_resposta")?.annotations
        ?.idempotentHint,
      true,
    );
    assert.deepEqual(
      new Set(resourceTemplates.map((resource) => resource.uriTemplate)),
      new Set([
        "oabase://legislacao/{lei_slug}/{artigo_slug}",
        "oabase://sumulas/{slug}",
      ]),
    );
    assert.deepEqual(
      new Set(prompts.map((prompt) => prompt.name)),
      new Set([
        "montar-sessao-de-estudo",
        "revisar-para-prova",
        "fechar-sessao-de-estudo",
      ]),
    );
  } finally {
    await conexao.fechar();
  }
});

test("diferencia falta de autenticação de uma lista vazia", async () => {
  const conexao = await conectar({
    supabase: clienteFalso(() => {
      throw new Error("o banco não deveria ser consultado");
    }),
    usuario: null,
    transporte: "teste",
  });
  try {
    const resposta = await conexao.client.callTool({
      name: "buscar_questoes",
      arguments: {},
    });
    assert.equal(resposta.isError, true);
    assert.equal(
      (resposta.structuredContent as { erro: { codigo: string } }).erro.codigo,
      "AUTH_REQUIRED",
    );
  } finally {
    await conexao.fechar();
  }
});

test("busca de súmulas usa RPC exclusiva e devolve conteúdo estruturado", async () => {
  let rpc = "";
  const conexao = await conectar({
    supabase: clienteFalso((nome) => {
      rpc = nome;
      return {
        data: [
          {
            tipo: "sumula",
            id: "11111111-1111-4111-8111-111111111111",
            rotulo: "Súmula Vinculante 11",
            resumo: "Enunciado oficial",
            href: "/sumulas/sumula-vinculante-11",
            comentado: false,
          },
        ],
        error: null,
      };
    }),
    usuario: null,
    transporte: "teste",
  });
  try {
    const resposta = await conexao.client.callTool({
      name: "buscar_sumulas",
      arguments: { termo: "algemas", limite: 5 },
    });
    assert.equal(rpc, "buscar_sumulas");
    assert.equal(resposta.isError, undefined);
    const dados = resposta.structuredContent as {
      ok: boolean;
      dados: { itens: Array<{ url: string }> };
    };
    assert.equal(dados.ok, true);
    assert.equal(
      dados.dados.itens[0]?.url,
      "https://oabase.com.br/sumulas/sumula-vinculante-11",
    );
    const recurso = resposta.content.find((item) => item.type === "resource_link");
    assert.equal(
      recurso?.type === "resource_link" ? recurso.uri : null,
      "oabase://sumulas/sumula-vinculante-11",
    );
  } finally {
    await conexao.fechar();
  }
});

test("HTTP publica discovery e rejeita requisição sem identidade", async () => {
  const porta = await portaLivre();
  const processo = spawn(
    process.execPath,
    ["--import", "tsx", "src/mcp/server.ts"],
    {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MCP_TRANSPORT: "http",
      MCP_HOST: "127.0.0.1",
      MCP_PORT: String(porta),
      MCP_PUBLIC_URL: `http://127.0.0.1:${porta}/mcp`,
      MCP_ALLOWED_ORIGINS: "https://cliente.example",
      NEXT_PUBLIC_SUPABASE_URL: "https://projeto-teste.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "chave-publicavel-de-teste",
    },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Servidor HTTP não iniciou a tempo.")),
        8_000,
      );
      processo.once("exit", (codigo) => {
        clearTimeout(timeout);
        reject(new Error(`Servidor HTTP encerrou com ${codigo}.`));
      });
      processo.stderr.on("data", (pedaco) => {
        if (String(pedaco).includes("MCP HTTP ouvindo")) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    const base = `http://127.0.0.1:${porta}`;
    const discovery = await fetch(`${base}/.well-known/oauth-protected-resource/mcp`);
    assert.equal(discovery.status, 200);
    const metadata = await discovery.json() as {
      resource: string;
      authorization_servers: string[];
    };
    assert.equal(metadata.resource, `${base}/mcp`);
    assert.deepEqual(metadata.authorization_servers, [
      "https://projeto-teste.supabase.co/auth/v1",
    ]);

    const semToken = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    });
    assert.equal(semToken.status, 401);
    assert.match(semToken.headers.get("www-authenticate") ?? "", /resource_metadata/);

    const origemInvalida = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://malicioso.example",
      },
      body: "{}",
    });
    assert.equal(origemInvalida.status, 403);
  } finally {
    processo.kill("SIGTERM");
    await Promise.race([
      new Promise<void>((resolve) => {
        if (processo.exitCode !== null) resolve();
        else processo.once("exit", () => resolve());
      }),
      new Promise<void>((resolve) => {
        setTimeout(() => {
          processo.kill("SIGKILL");
          resolve();
        }, 2_000).unref();
      }),
    ]);
  }
});

test("Route Handler serverless exige OAuth sem iniciar o protocolo", async () => {
  const resposta = await responderMcp(new Request("https://oabase.com.br/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
  }));
  assert.equal(resposta.status, 401);
  assert.match(resposta.headers.get("www-authenticate") ?? "", /oauth-protected-resource/);
});
