/**
 * Cliente da Asaas. **Somente servidor** — as chaves não têm prefixo público
 * e nunca chegam ao navegador.
 *
 * O ambiente é sandbox por padrão e só vira produção com
 * `ASAAS_AMBIENTE=producao` declarado de forma explícita. A escolha é
 * deliberada: o pior defeito possível aqui é cobrar dinheiro de verdade por
 * engano, e um padrão inseguro transforma qualquer descuido de configuração
 * nesse defeito.
 */

export type Ambiente = "sandbox" | "producao";

export const ambienteAsaas: Ambiente =
  process.env.ASAAS_AMBIENTE === "producao" ? "producao" : "sandbox";

const BASE =
  ambienteAsaas === "producao"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

function chave() {
  const valor =
    ambienteAsaas === "producao"
      ? process.env.ASAAS_API_KEY
      : process.env.ASAAS_API_KEY_SANDBOX;
  if (!valor) {
    throw new Error(
      `Chave da Asaas ausente para o ambiente "${ambienteAsaas}".`,
    );
  }
  return valor;
}

export class ErroAsaas extends Error {
  constructor(
    public readonly descricao: string,
    public readonly campo?: string,
    /** Status HTTP da Asaas. O webhook precisa separar "não existe" de
        "não deu para falar com a Asaas": o primeiro é definitivo, o segundo
        merece nova tentativa. */
    public readonly status?: number,
  ) {
    super(descricao);
    this.name = "ErroAsaas";
  }
}

type RespostaComErro = {
  errors?: { code?: string; description?: string }[];
};

async function chamar<T>(
  caminho: string,
  init?: { method?: string; corpo?: unknown },
): Promise<T> {
  const resposta = await fetch(`${BASE}${caminho}`, {
    method: init?.method ?? "GET",
    headers: {
      access_token: chave(),
      "Content-Type": "application/json",
    },
    body: init?.corpo ? JSON.stringify(init.corpo) : undefined,
    cache: "no-store",
  });

  // A Asaas responde 404 com corpo **vazio**. Chamar `.json()` direto estoura
  // com um erro de parse, e aí o status HTTP — que é a única informação útil
  // no caso — se perde no caminho.
  const texto = await resposta.text();
  let dados: (T & RespostaComErro) | null = null;
  try {
    dados = texto ? (JSON.parse(texto) as T & RespostaComErro) : null;
  } catch {
    dados = null;
  }

  if (!resposta.ok || dados === null || dados.errors?.length) {
    const primeiro = dados?.errors?.[0];
    throw new ErroAsaas(
      primeiro?.description ?? `Asaas respondeu ${resposta.status}.`,
      primeiro?.code,
      resposta.status,
    );
  }
  return dados;
}

export type Cliente = { id: string };

export async function criarOuAtualizarCliente(dados: {
  clienteExistente: string | null;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
}): Promise<Cliente> {
  const corpo = {
    name: dados.nome,
    cpfCnpj: dados.cpf,
    email: dados.email,
    mobilePhone: dados.telefone,
    // A cobrança do OABase é avulsa e o aviso é nosso; a régua de e-mails da
    // Asaas duplicaria a comunicação.
    notificationDisabled: true,
  };

  // Reaproveita o cadastro: o mesmo CPF criaria cliente duplicado na Asaas a
  // cada tentativa de pagamento.
  if (dados.clienteExistente) {
    return chamar<Cliente>(`/customers/${dados.clienteExistente}`, {
      method: "POST",
      corpo,
    });
  }
  return chamar<Cliente>("/customers", { method: "POST", corpo });
}

export type Cobranca = {
  id: string;
  status: string;
  value: number;
  invoiceUrl: string;
};

export async function criarCobranca(dados: {
  clienteId: string;
  valor: number;
  descricao: string;
  referencia: string;
  diasParaVencer: number;
}): Promise<Cobranca> {
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + dados.diasParaVencer);

  return chamar<Cobranca>("/payments", {
    method: "POST",
    corpo: {
      customer: dados.clienteId,
      // UNDEFINED deixa a escolha do meio para quem paga — Pix, cartão ou
      // boleto na mesma tela. Fixar em cartão excluiria quem paga por Pix,
      // que é a maioria neste público.
      billingType: "UNDEFINED",
      value: dados.valor,
      dueDate: vencimento.toISOString().slice(0, 10),
      description: dados.descricao,
      externalReference: dados.referencia,
    },
  });
}

/**
 * Consulta uma cobrança pelo id.
 *
 * Existe para o webhook não acreditar no corpo que recebeu. O evento chega
 * por HTTP público; confirmar o status na fonte é a diferença entre liberar
 * acesso porque a Asaas disse que foi pago e liberar porque alguém enviou um
 * JSON dizendo isso.
 */
export async function consultarCobranca(id: string): Promise<Cobranca> {
  return chamar<Cobranca>(`/payments/${encodeURIComponent(id)}`);
}
