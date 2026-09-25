/**
 * Identidade de quem opera o serviço e datas dos documentos legais.
 *
 * Fica num arquivo só porque os mesmos dados aparecem nos Termos, na Política
 * de Privacidade, no rodapé e no JSON-LD da organização. Razão social errada
 * em um lugar e certa em outro é o tipo de inconsistência que aparece
 * justamente quando alguém vai reclamar.
 *
 * **Nenhum campo pode voltar a ficar vazio.** `dadosPendentes` continua aqui
 * porque a checagem é que importa, não o estado de hoje: enquanto faltar
 * qualquer um deles, as duas páginas exibem um aviso no topo e
 * `/api/assinar` recusa cobrança em produção. Melhor a falha ser visível do
 * que publicar um documento com "CNPJ 00.000.000/0001-00" e ninguém
 * perceber — ou, pior, cobrar por trás dele.
 */

export const operador = {
  /** Razão social ou nome completo de quem emite a cobrança. */
  razaoSocial: "57.162.203 Yago Henrique Fontanez",
  /** CNPJ, ou CPF se a operação for como pessoa física. */
  documento: "57.162.203/0001-00",
  /** Endereço completo — exigido pelo CDC na oferta a distância. */
  endereco:
    "Rua Coronel Simões, nº 452, fundos, Centro, Dois Córregos/SP, CEP 17300-061",
  /** Canal de atendimento. Aparece nos dois documentos. */
  email: "contato@oabase.com.br",
  /** Encarregado pelo tratamento de dados (LGPD, art. 41). */
  encarregado: "contato@oabase.com.br",
  /** Comarca do foro eleito. */
  comarca: "Dois Córregos, Estado de São Paulo",
} as const;

/** Falta alguma coisa para estes documentos valerem? */
export const dadosPendentes: string[] = (
  [
    ["razão social", operador.razaoSocial],
    ["CNPJ ou CPF", operador.documento],
    ["endereço", operador.endereco],
    ["comarca do foro", operador.comarca],
  ] as const
)
  .filter(([, valor]) => !valor)
  .map(([rotulo]) => rotulo);

/**
 * Data da última revisão de cada documento.
 *
 * Atualizar sempre que o texto mudar: a LGPD e o CDC pedem que a pessoa
 * consiga saber qual versão aceitou, e "atualizado hoje" gerado por
 * `new Date()` seria mentira automática a cada deploy.
 */
export const vigencia = {
  // Revisão de 02/09/2026: identificação do operador (razão social, CNPJ,
  // endereço e comarca), que até então saía nas duas páginas como pendente.
  // Revisão de 25/09/2026: renovação automática do Mensal, cancelamento em
  // Configurações e encerramento por fatura não paga (Termos); identificador
  // da assinatura e cartão guardado pelo processador (Privacidade).
  termos: "2026-09-25",
  privacidade: "2026-09-25",
} as const;

/**
 * Operadores que tratam dados em nome do OABase.
 *
 * A LGPD não exige listar nominalmente, mas listar é o que permite à pessoa
 * entender para onde o dado dela vai — e é o que torna a transferência
 * internacional verificável em vez de uma frase genérica.
 */
export const subprocessadores = [
  {
    nome: "Supabase",
    papel: "Banco de dados, autenticação e armazenamento da conta",
    dados: "e-mail, senha (em hash), e todo o histórico de estudo",
    local: "Estados Unidos",
  },
  {
    nome: "Asaas",
    papel: "Emissão e processamento das cobranças",
    dados: "nome, CPF, e-mail e telefone",
    local: "Brasil",
  },
  {
    nome: "Resend",
    papel: "Envio dos e-mails do serviço",
    dados: "e-mail e primeiro nome",
    local: "Estados Unidos",
  },
  {
    nome: "Groq",
    papel: "Geração do cronograma de estudos por IA",
    dados:
      "o texto que você escreve na conversa do plano e o total de minutos estudados por disciplina",
    local: "Estados Unidos",
  },
  {
    nome: "Netlify",
    papel: "Hospedagem do site",
    dados: "endereço IP e dados de registro de acesso",
    local: "Estados Unidos",
  },
] as const;
