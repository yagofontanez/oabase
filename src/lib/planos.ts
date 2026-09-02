/**
 * Fonte única dos planos. Consumida pela seção da landing e por /precos —
 * duas listas de preço mantidas à mão divergem na primeira alteração.
 *
 * A estrutura segue o ciclo do exame: a oferta principal não é uma
 * mensalidade perpétua, é acesso até a data da prova.
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
    resumo: "Acesso completo para ver se o método funciona pra você.",
    itens: [
      "Banco de questões completo",
      "Gabarito oficial da FGV em todas elas",
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
      "Para quem quer entrar barato e decidir depois quanto tempo vai ficar.",
    itens: [
      "Banco de questões completo",
      "Caderno de erros automático",
      "Cronograma até a data do exame",
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
      "Cronograma até a data do exame",
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
    resumo: "Para quem vai encarar mais de uma edição — ou prefere folga.",
    itens: [
      "Tudo do plano Até a prova",
      "Cobre dois exames seguidos",
      "Estatísticas de evolução no ano",
    ],
    destaque: false,
    cta: "Assinar anual",
  },
];
