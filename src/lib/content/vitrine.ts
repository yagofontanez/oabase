/**
 * Questão de vitrine da landing.
 *
 * É material de marketing, não o produto: fica aqui, em código, e não vem da
 * tabela `questoes` — que é protegida por RLS e exige assinatura. Assim a
 * página pública nunca precisa de uma credencial capaz de ler o banco pago.
 *
 * Fonte: 43º Exame de Ordem Unificado, prova tipo 1 (branca), questão 65.
 * Gabarito definitivo da FGV, aplicado em 27/04/2025.
 */
export const questaoVitrine = {
  exame: 43,
  numero: 65,
  disciplina: "Direito Processual Penal",
  enunciado:
    "Fábio foi submetido a julgamento pelo Tribunal do Júri e, ao final, condenado a uma pena de 15 anos de reclusão, em regime inicial fechado. Você, como advogado(a) de Fábio, interpôs tempestivo e cabível recurso. Assinale a opção que indica o recurso correto interposto e/ou suas características.",
  alternativas: {
    A: "O recurso cabível é de apelação e o efeito devolutivo é restrito aos fundamentos de interposição.",
    B: "A alegação de decisão manifestamente contrária à prova dos autos só pode ser repetida por, no máximo, três vezes.",
    C: "O recurso cabível é o recurso em sentido estrito e tem efeito regressivo que pode ser exercido pelos próprios jurados.",
    D: "O recurso cabível tem ampla devolutividade, podendo o Tribunal rever todos os aspectos da sentença penal condenatória, inclusive as teses atinentes à materialidade e à autoria.",
  } as Record<string, string>,
  gabarito: "A",
  comentario:
    "Da decisão do Júri cabe **apelação**, mas ela não devolve tudo ao Tribunal. A soberania dos veredictos limita o efeito devolutivo às hipóteses do art. 593, III, do CPP, e apenas àquela expressamente invocada na interposição — é a chamada devolutividade restrita. Por isso a (D) erra ao falar em ampla devolutividade, e a (C) erra o recurso.",
} as const;
