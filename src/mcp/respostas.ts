import type { CallToolResult } from "@modelcontextprotocol/server";

export type CodigoMcp =
  | "AUTH_REQUIRED"
  | "SUBSCRIPTION_REQUIRED"
  | "NOT_FOUND"
  | "PRECONDITION_REQUIRED"
  | "CONFLICT"
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

export type ErroDoBanco = {
  code?: string;
  message: string;
};

function textoJson(valor: Record<string, unknown>) {
  return JSON.stringify(valor, null, 2);
}

/** O objeto atende clientes modernos; o bloco de texto preserva os antigos. */
export function sucesso(
  dados: Record<string, unknown>,
  extras: CallToolResult["content"] = [],
): CallToolResult {
  return {
    structuredContent: dados,
    content: [{ type: "text", text: textoJson(dados) }, ...extras],
  };
}

export function falha(
  codigo: CodigoMcp,
  mensagem: string,
  opcoes: { retryable?: boolean; actionUrl?: string } = {},
): CallToolResult {
  const erro = {
    ok: false,
    erro: {
      codigo,
      mensagem,
      retryable: opcoes.retryable ?? false,
      ...(opcoes.actionUrl ? { actionUrl: opcoes.actionUrl } : {}),
    },
  };
  return {
    isError: true,
    structuredContent: erro,
    content: [{ type: "text", text: textoJson(erro) }],
  };
}

/** Não entrega mensagens internas do PostgREST ao modelo. */
export function falhaDoBanco(error: ErroDoBanco, contexto: string) {
  if (error.code === "42501") {
    return falha(
      "SUBSCRIPTION_REQUIRED",
      "Esta ação exige uma assinatura ativa do OABase.",
      { actionUrl: "/app/assinar" },
    );
  }
  if (error.code === "28000" || error.code === "PGRST301") {
    return falha("AUTH_REQUIRED", "Entre novamente para continuar.", {
      actionUrl: "/entrar",
    });
  }
  if (error.code === "23505") {
    return falha("CONFLICT", "Já existe uma operação incompatível em andamento.");
  }
  if (error.code === "22023" || error.code === "22P02") {
    return falha("INVALID_INPUT", "Os dados informados não são válidos para esta ação.");
  }

  console.error(JSON.stringify({ nivel: "erro", contexto, codigo: error.code ?? null }));
  return falha(
    "UPSTREAM_ERROR",
    "O OABase não conseguiu concluir a consulta agora. Tente novamente.",
    { retryable: true },
  );
}

export const schemaErro = {
  ok: false as const,
  erro: {
    codigo: "INTERNAL_ERROR" as CodigoMcp,
    mensagem: "",
    retryable: false,
  },
};
