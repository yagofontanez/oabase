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
  preco: string;
  /** Mesmo valor em número — o JSON-LD precisa dele sem formatação. */
  precoNumerico: number;
  periodo: string;
  resumo: string;
  itens: string[];
  destaque: boolean;
  cta: string;
};

export const planos: Plano[] = [
  {
    chave: "experimentar",
    nome: "Experimentar",
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
  },
  {
    chave: "mensal",
    nome: "Mensal",
    preco: "R$ 15",
    precoNumerico: 15,
    periodo: "por mês",
    resumo:
      "Para acompanhar as provas do semestre ou estudar para a OAB no seu ritmo.",
    itens: [
      "Roadmap para qualquer avaliação",
      "Banco completo de questões da OAB",
      "Caderno de erros automático",
      "Calendário e sessões de foco",
      "Cancela quando quiser",
    ],
    destaque: false,
    cta: "Assinar mensal",
  },
  {
    chave: "ate-a-prova",
    nome: "Até a prova",
    preco: "R$ 109",
    precoNumerico: 109,
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
  },
  {
    chave: "anual",
    nome: "Anual",
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
  },
];
