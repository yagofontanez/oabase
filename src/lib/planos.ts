/**
 * Fonte única dos planos. Consumida pela seção da landing e por /precos —
 * duas listas de preço mantidas à mão divergem na primeira alteração.
 *
 * A estrutura atende tanto o uso contínuo na graduação quanto o ciclo
 * fechado do Exame de Ordem.
 */
export type Plano = {
  chave: string;
  nome: string;
  /** Plano exposto para novas contratações. Histórico segue reconhecido. */
  disponivel: boolean;
  preco: string;
  /** Mesmo valor em número — o JSON-LD precisa dele sem formatação. */
  precoNumerico: number;
  periodo: string;
  resumo: string;
  itens: string[];
  destaque: boolean;
  cta: string;
  /**
   * Renova sozinho todo mês (assinatura da Asaas) até a pessoa cancelar em
   * /app/configuracoes. Só o Mensal: Experimentar termina sozinho por
   * promessa, e Até a prova termina no dia do exame por natureza.
   */
  recorrente: boolean;
};

export const planos: Plano[] = [
  {
    chave: "experimentar",
    nome: "Experimentar",
    disponivel: true,
    preco: "R$ 1",
    precoNumerico: 1,
    periodo: "por 7 dias",
    resumo: "Acesso completo para montar um plano e experimentar o método.",
    itens: [
      "Roadmap para faculdade ou OAB",
      "Sessões de foco e revisão",
      "Cancela sozinho, sem cobrança automática",
    ],
    destaque: false,
    cta: "Começar por R$ 1",
    recorrente: false,
  },
  {
    chave: "mensal",
    nome: "Mensal",
    disponivel: true,
    preco: "R$ 15",
    precoNumerico: 15,
    periodo: "por mês, renova sozinho",
    resumo:
      "Para acompanhar as provas do semestre ou estudar para a OAB no seu ritmo.",
    itens: [
      "Roadmap para qualquer avaliação",
      "Banco completo de questões da OAB",
      "Caderno de erros automático",
      "Calendário e sessões de foco",
      "Renova todo mês; cancele em Configurações quando quiser",
    ],
    destaque: false,
    cta: "Assinar mensal",
    recorrente: true,
  },
  {
    chave: "ate-a-prova",
    nome: "Até a prova",
    disponivel: true,
    preco: "R$ 49",
    precoNumerico: 49,
    periodo: "acesso até o dia do exame",
    resumo:
      "Feito para o ciclo real: você entra hoje e sai no dia em que fizer a prova.",
    itens: [
      "Simulados cronometrados",
      "Caderno de erros automático",
      "Revisão espaçada",
      "Roadmap até a data do exame",
      "Estatísticas de desempenho por disciplina",
    ],
    destaque: true,
    cta: "Assinar até a prova",
    recorrente: false,
  },
  {
    chave: "anual",
    nome: "Anual",
    // Preservado para reconhecer assinaturas e cobranças anteriores, mas não
    // é vendido enquanto a demanda real por um ciclo de 12 meses não existir.
    disponivel: false,
    preco: "R$ 199",
    precoNumerico: 199,
    periodo: "por 12 meses",
    resumo: "Para atravessar o ano letivo e chegar à OAB com todo o histórico junto.",
    itens: [
      "Tudo do plano Até a prova",
      "Planos para as provas da faculdade",
      "Cobre dois exames da OAB seguidos",
      "Estatísticas de evolução no ano",
    ],
    destaque: false,
    cta: "Assinar anual",
    recorrente: false,
  },
];

/** A única lista que pode aparecer na oferta ou aceitar uma compra nova. */
export const planosDisponiveis = planos.filter((plano) => plano.disponivel);
