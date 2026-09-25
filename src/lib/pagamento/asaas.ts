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

import { dadosPendentes } from "@/lib/legal";

export type Ambiente = "sandbox" | "producao";

export const ambienteAsaas: Ambiente =
  process.env.ASAAS_AMBIENTE === "producao" ? "producao" : "sandbox";

/**
 * Existe cobrança de verdade hoje?
 *
 * Duas condições, e as duas são de fato necessárias: ambiente de produção e
 * `legal.ts` completo — sem razão social, CNPJ e endereço publicados a oferta
 * a distância não cumpre o CDC. Fica aqui, e não solto em cada tela, para que
 * a resposta seja a mesma na rota que cria a cobrança e no texto que promete
 * (ou não promete) cobrança à pessoa que está criando a conta. Uma frase de
 * interface que envelhece sozinha vira mentira no dia do lançamento.
 */
export const cobrancaLiberada =
  ambienteAsaas === "producao" && dadosPendentes.length === 0;

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
  /** "YYYY-MM-DD". */
  dueDate: string;
  billingType: string;
  /** Presente quando a cobrança foi gerada por uma assinatura. */
  subscription?: string | null;
  /** A Asaas não apaga: marca. Cobrança pendente de assinatura cancelada
      continua respondendo, com `deleted: true`. */
  deleted?: boolean;
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

/* ---------------------------------------------------------------------- */
/* Assinaturas (recorrência do plano Mensal)                              */
/* ---------------------------------------------------------------------- */

export type Assinatura = {
  id: string;
  status: string;
  billingType: string;
  deleted?: boolean;
};

/** Reconsulta, pelo mesmo motivo de `consultarCobranca`. */
export async function consultarAssinatura(id: string): Promise<Assinatura> {
  return chamar<Assinatura>(`/subscriptions/${encodeURIComponent(id)}`);
}

/**
 * Cria a assinatura mensal e devolve a primeira cobrança dela.
 *
 * `UNDEFINED`, como na cobrança avulsa: a pessoa escolhe Pix, cartão ou
 * boleto na fatura. Se pagar no cartão, a Asaas guarda o token e troca a
 * assinatura para `CREDIT_CARD` sozinha — os meses seguintes são debitados
 * sem ninguém agir. Se pagar por Pix, cada mês gera uma fatura nova. Conferido
 * no sandbox; a documentação da Asaas não descreve esse caso.
 *
 * A Asaas cria a primeira cobrança no ato, com vencimento em `nextDueDate`, e
 * as seguintes no mesmo dia dos meses seguintes.
 */
export async function criarAssinatura(dados: {
  clienteId: string;
  valor: number;
  descricao: string;
  referencia: string;
  diasParaVencer: number;
}): Promise<{ assinatura: Assinatura; primeira: Cobranca }> {
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + dados.diasParaVencer);

  const assinatura = await chamar<Assinatura>("/subscriptions", {
    method: "POST",
    corpo: {
      customer: dados.clienteId,
      billingType: "UNDEFINED",
      value: dados.valor,
      nextDueDate: vencimento.toISOString().slice(0, 10),
      cycle: "MONTHLY",
      description: dados.descricao,
      externalReference: dados.referencia,
    },
  });

  const [primeira] = await cobrancasDaAssinatura(assinatura.id);
  if (!primeira) {
    // Sem a primeira cobrança não há fatura para mandar a pessoa, e uma
    // assinatura órfã cobraria no mês que vem sem nunca ter sido paga.
    await cancelarAssinatura(assinatura.id).catch(() => {});
    throw new ErroAsaas("A Asaas não gerou a primeira cobrança da assinatura.");
  }
  return { assinatura, primeira };
}

/** Cobranças de uma assinatura, da mais antiga para a mais nova. */
export async function cobrancasDaAssinatura(
  id: string,
  status?: string,
): Promise<Cobranca[]> {
  const filtro = status ? `&status=${encodeURIComponent(status)}` : "";
  const resposta = await chamar<{ data: Cobranca[] }>(
    `/subscriptions/${encodeURIComponent(id)}/payments?limit=100${filtro}`,
  );
  return [...resposta.data].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * Cancela a assinatura. A Asaas remove as cobranças ainda em aberto e mantém
 * as pagas — cancelar interrompe o futuro, não devolve o passado.
 */
export async function cancelarAssinatura(id: string): Promise<void> {
  await chamar<{ deleted: boolean }>(`/subscriptions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
