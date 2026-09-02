import type { Artigo, Disciplina, Exame, Lei } from "./types";

/* ------------------------------------------------------------------
   Dados de exemplo. Substituídos por consultas ao Supabase na Fase 0;
   o formato aqui é o contrato que as páginas já consomem.
   ------------------------------------------------------------------ */

export const disciplinas: Disciplina[] = [
  {
    slug: "etica-e-estatuto-da-oab",
    nome: "Ética e Estatuto da OAB",
    mediaPorProva: 8,
  },
  {
    slug: "direito-constitucional",
    nome: "Direito Constitucional",
    mediaPorProva: 7,
  },
  { slug: "direito-civil", nome: "Direito Civil", mediaPorProva: 7 },
  {
    slug: "direito-processual-civil",
    nome: "Direito Processual Civil",
    mediaPorProva: 7,
  },
  { slug: "direito-penal", nome: "Direito Penal", mediaPorProva: 6 },
  {
    slug: "direito-do-trabalho",
    nome: "Direito do Trabalho",
    mediaPorProva: 6,
  },
  {
    slug: "direito-processual-penal",
    nome: "Direito Processual Penal",
    mediaPorProva: 5,
  },
  {
    slug: "direito-administrativo",
    nome: "Direito Administrativo",
    mediaPorProva: 5,
  },
  {
    slug: "direito-empresarial",
    nome: "Direito Empresarial",
    mediaPorProva: 5,
  },
  {
    slug: "direito-processual-do-trabalho",
    nome: "Direito Processual do Trabalho",
    mediaPorProva: 4,
  },
  { slug: "direito-tributario", nome: "Direito Tributário", mediaPorProva: 4 },
  { slug: "direitos-humanos", nome: "Direitos Humanos", mediaPorProva: 3 },
  {
    slug: "direito-previdenciario",
    nome: "Direito Previdenciário",
    mediaPorProva: 3,
  },
  {
    slug: "filosofia-do-direito",
    nome: "Filosofia do Direito",
    mediaPorProva: 2,
  },
  {
    slug: "direito-internacional",
    nome: "Direito Internacional",
    mediaPorProva: 2,
  },
  { slug: "direito-ambiental", nome: "Direito Ambiental", mediaPorProva: 2 },
  {
    slug: "direito-do-consumidor",
    nome: "Direito do Consumidor",
    mediaPorProva: 2,
  },
  {
    slug: "estatuto-da-crianca-e-do-adolescente",
    nome: "ECA",
    mediaPorProva: 2,
  },
];

export const leis: Lei[] = [
  {
    slug: "constituicao-federal",
    nome: "Constituição Federal",
    sigla: "CF/88",
    ano: 1988,
    resumo:
      "A norma mais cobrada do exame. Direitos fundamentais, organização do Estado e controle de constitucionalidade aparecem em toda edição.",
    disciplinaSlug: "direito-constitucional",
  },
  {
    slug: "codigo-civil",
    nome: "Código Civil",
    sigla: "CC",
    ano: 2002,
    resumo:
      "Base de Direito Civil na prova: responsabilidade civil, contratos, direitos reais e família concentram a maior parte das questões.",
    disciplinaSlug: "direito-civil",
  },
  {
    slug: "codigo-penal",
    nome: "Código Penal",
    sigla: "CP",
    ano: 1940,
    resumo:
      "Parte geral e crimes contra a pessoa e o patrimônio dominam a incidência em Direito Penal.",
    disciplinaSlug: "direito-penal",
  },
];

export const artigos: Artigo[] = [
  {
    leiSlug: "constituicao-federal",
    slug: "artigo-5",
    numero: "5º",
    disciplinaSlug: "direito-constitucional",
    caput:
      "Todos são iguais perante a lei, sem distinção de qualquer natureza, garantindo-se aos brasileiros e aos estrangeiros residentes no País a inviolabilidade do direito à vida, à liberdade, à igualdade, à segurança e à propriedade, nos termos seguintes:",
    paragrafos: [
      "§ 1º As normas definidoras dos direitos e garantias fundamentais têm aplicação imediata.",
      "§ 2º Os direitos e garantias expressos nesta Constituição não excluem outros decorrentes do regime e dos princípios por ela adotados, ou dos tratados internacionais em que a República Federativa do Brasil seja parte.",
      "§ 3º Os tratados e convenções internacionais sobre direitos humanos que forem aprovados, em cada Casa do Congresso Nacional, em dois turnos, por três quintos dos votos dos respectivos membros, serão equivalentes às emendas constitucionais.",
    ],
    comentario: [
      "É o artigo mais cobrado do exame inteiro, e quase nunca na forma de decoreba do caput. A FGV costuma montar um caso concreto curto e pedir qual inciso resolve a situação — o que exige leitura de aplicação, não memorização de lista.",
      "Preste atenção especial ao **§ 3º**: tratados de direitos humanos aprovados pelo rito das emendas ganham status constitucional; fora desse rito, o STF firmou o entendimento de que valem como norma **supralegal** — acima da lei ordinária, abaixo da Constituição. Essa distinção de hierarquia é a pegadinha recorrente.",
      "O **§ 1º** também rende questão: aplicação imediata não significa que toda norma de direito fundamental dispense regulamentação, e é justamente aí que o mandado de injunção entra como remédio.",
    ],
    incidencia: 47,
    atualizadoEm: "2026-07-14",
    indexavel: true,
  },
  {
    leiSlug: "constituicao-federal",
    slug: "artigo-37",
    numero: "37",
    disciplinaSlug: "direito-administrativo",
    caput:
      "A administração pública direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios obedecerá aos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência e, também, ao seguinte:",
    paragrafos: [
      "§ 6º As pessoas jurídicas de direito público e as de direito privado prestadoras de serviços públicos responderão pelos danos que seus agentes, nessa qualidade, causarem a terceiros, assegurado o direito de regresso contra o responsável nos casos de dolo ou culpa.",
    ],
    comentario: [
      "O caput traz o mnemônico que todo mundo decora — **LIMPE** — mas a prova raramente pergunta a sigla. Ela pergunta qual princípio foi violado num caso concreto, e a confusão frequente é entre impessoalidade e moralidade.",
      "O **§ 6º** é o coração da responsabilidade civil do Estado: responsabilidade **objetiva** perante o terceiro lesado (basta conduta, dano e nexo), e **subjetiva** na ação de regresso contra o agente, que só responde havendo dolo ou culpa. Trocar essas duas naturezas é o erro mais comum do tema.",
      "Note que o dispositivo alcança pessoas jurídicas de direito privado **prestadoras de serviço público** — concessionárias entram, empresa estatal exploradora de atividade econômica não.",
    ],
    incidencia: 31,
    atualizadoEm: "2026-06-02",
    indexavel: true,
  },
  {
    leiSlug: "codigo-civil",
    slug: "artigo-186",
    numero: "186",
    disciplinaSlug: "direito-civil",
    caput:
      "Aquele que, por ação ou omissão voluntária, negligência ou imprudência, violar direito e causar dano a outrem, ainda que exclusivamente moral, comete ato ilícito.",
    paragrafos: [],
    comentario: [
      "Artigo curto e de altíssima incidência. Ele define o ato ilícito pela **cláusula geral da culpa**, reunindo quatro elementos: conduta, culpa em sentido amplo (dolo, negligência ou imprudência), dano e nexo causal.",
      "A expressão “ainda que exclusivamente moral” é o gancho preferido da banca: consagra o dano moral autônomo, que não depende de repercussão patrimonial para ser indenizável.",
      "Leia sempre em conjunto com o **art. 927** — o 186 define o ilícito, o 927 impõe o dever de reparar. Questões que misturam os dois costumam testar se o candidato sabe onde mora a responsabilidade objetiva.",
    ],
    incidencia: 28,
    atualizadoEm: "2026-05-19",
    indexavel: true,
  },
  {
    leiSlug: "codigo-civil",
    slug: "artigo-927",
    numero: "927",
    disciplinaSlug: "direito-civil",
    caput:
      "Aquele que, por ato ilícito (arts. 186 e 187), causar dano a outrem, fica obrigado a repará-lo.",
    paragrafos: [
      "Parágrafo único. Haverá obrigação de reparar o dano, independentemente de culpa, nos casos especificados em lei, ou quando a atividade normalmente desenvolvida pelo autor do dano implicar, por sua natureza, risco para os direitos de outrem.",
    ],
    // Comentário ainda em revisão editorial: a página existe, mas fica
    // fora do índice e fora do sitemap até passar do limiar de qualidade.
    comentario: [],
    incidencia: 24,
    atualizadoEm: "2026-08-11",
    indexavel: false,
  },
  {
    leiSlug: "codigo-penal",
    slug: "artigo-121",
    numero: "121",
    disciplinaSlug: "direito-penal",
    caput: "Matar alguém: Pena — reclusão, de seis a vinte anos.",
    paragrafos: [
      "§ 1º Se o agente comete o crime impelido por motivo de relevante valor social ou moral, ou sob o domínio de violenta emoção, logo em seguida a injusta provocação da vítima, o juiz pode reduzir a pena de um sexto a um terço.",
      "§ 2º Se o homicídio é cometido por motivo torpe, fútil, com emprego de veneno, fogo, explosivo, asfixia, tortura ou outro meio insidioso ou cruel, ou à traição, de emboscada, ou mediante dissimulação: Pena — reclusão, de doze a trinta anos.",
    ],
    comentario: [
      "O tipo básico é de uma linha, mas a prova vive das qualificadoras e da causa de diminuição. O **§ 1º** traz o chamado homicídio privilegiado — causa de diminuição obrigatória quanto ao reconhecimento, facultativa quanto ao quantum.",
      "Distinção que a FGV cobra com frequência: motivo **fútil** é o de somenos importância; motivo **torpe** é o repugnante, vil. Ciúme, isoladamente, a jurisprudência majoritária não reconhece como torpe.",
      "O homicídio privilegiado-qualificado é admitido quando a qualificadora é de natureza **objetiva** (meio ou modo de execução), já que privilegiadoras são sempre subjetivas e seriam incompatíveis com qualificadoras subjetivas.",
    ],
    incidencia: 19,
    atualizadoEm: "2026-04-28",
    indexavel: true,
  },
];

/** Distribuição típica da 1ª fase — 80 questões. */
const distribuicaoBase: Record<string, number> = Object.fromEntries(
  disciplinas.map((d) => [d.slug, d.mediaPorProva]),
);

function distribuicao(ajustes: Record<string, number> = {}) {
  return Object.entries({ ...distribuicaoBase, ...ajustes }).map(
    ([disciplinaSlug, questoes]) => ({ disciplinaSlug, questoes }),
  );
}

/**
 * Fallback de desenvolvimento, usado só quando não há Supabase configurado.
 * Uma edição real apenas — datas inventadas viram indistinguíveis das reais
 * assim que convivem na mesma lista.
 */
export const exames: Exame[] = [
  {
    slug: "43",
    edicao: 43,
    ano: 2025,
    data: "2025-04-27",
    totalQuestoes: 80,
    questoesCarregadas: 80,
    questoesAnuladas: 2,
    gabaritoDefinitivo: true,
    distribuicao: distribuicao(),
  },
];

/**
 * Calendário oficial das próximas aplicações da 1ª fase.
 *
 * Era um valor único, e valor único de calendário tem data de validade: no
 * dia seguinte à prova a contagem regressiva do hero congela em zero e o
 * plano `ate-a-prova` passa a vender acesso até uma data que já passou. Uma
 * lista em ordem, de onde `getProximoExame()` tira a primeira aplicação que
 * ainda não aconteceu, resolve a virada sozinha — sem deploy no dia seguinte
 * ao exame.
 *
 * Datas do cronograma publicado pela própria OAB (Conselho Federal), não de
 * cursinho: https://www.oab.org.br/noticia/64207 — 47º em 06/09/2026, 48º em
 * 10/01/2027. **Acrescentar a próxima assim que o cronograma sair**: quando a
 * lista acaba, a última fica valendo e a contagem trava em zero, que é o
 * comportamento seguro (nada de data inventada), mas não é o correto.
 */
export const aplicacoes = [
  { edicao: 47, data: "2026-09-06" },
  { edicao: 48, data: "2027-01-10" },
] as const;
