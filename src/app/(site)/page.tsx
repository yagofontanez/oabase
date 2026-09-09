import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/container";
import { CartaoResposta, type Grupo } from "@/components/cartao-resposta";
import { Contagem } from "@/components/contagem";
import { QuestaoVitrine } from "@/components/questao-vitrine";
import { Reveal } from "@/components/reveal";
import { JsonLd } from "@/lib/jsonld";
import { abs, site } from "@/lib/site";
import { corPorPosicao } from "@/lib/paleta";
import { planos } from "@/lib/planos";
import {
  diasAte,
  getAcervo,
  getDisciplinas,
  getLeis,
  getProximoExame,
} from "@/lib/content/queries";
export const revalidate = 3600;
const metodo = [
  {
    titulo: "Responda",
    texto:
      "Questões reais dos exames unificados, na íntegra, com o gabarito oficial da FGV — inclusive as anulações. Você responde, o sistema corrige na hora e registra o acerto no seu histórico; o comentário autoral de cada questão está sendo escrito e aparece à medida que fica pronto.",
  },
  {
    titulo: "Erre",
    texto:
      "Toda questão que você erra entra sozinha no caderno de erros. Você não marca nada, não organiza planilha, não decide o que revisar. O erro é o dado mais valioso que você produz estudando, e ele não pode depender da sua disciplina para ser registrado.",
  },
  {
    titulo: "Volte",
    texto:
      "A questão errada reaparece no intervalo em que você está prestes a esquecê-la — não no dia seguinte, quando ainda está fresca, nem em três meses, quando já se foi. E só sai da fila depois que você acerta com folga, duas vezes seguidas.",
  },
];
const guia = [
  {
    titulo: "Você pode errar 40 questões e passar",
    corpo: [
      "A 1ª fase tem 80 questões objetivas e a aprovação exige 40 acertos. Metade. Esse número muda tudo na forma de estudar, e quase ninguém tira dele a conclusão certa.",
      "Não é preciso dominar as 18 disciplinas do edital. É preciso construir um colchão confortável nas disciplinas que mais caem e são mais previsíveis, e depois pescar acertos onde der. Quem tenta cobrir tudo com a mesma profundidade chega na prova sabendo um pouco de tudo e o suficiente de nada.",
    ],
  },
  {
    titulo: "Ética e Estatuto é o bloco mais barato da prova",
    corpo: [
      "A prova abre com Ética e Estatuto da OAB, e é sempre o primeiro bloco. São cerca de oito questões — 10% da prova — extraídas de duas fontes curtas e estáveis: o Estatuto da Advocacia e o Código de Ética e Disciplina.",
      "Nenhuma outra disciplina tem essa relação entre volume cobrado e volume de material. Direito Civil cobra sete questões de um código com mais de dois mil artigos; Ética cobra oito de um material que se lê em um fim de semana. Deixar esse bloco por último é o erro estratégico mais comum de quem está começando.",
    ],
  },
  {
    titulo: "O edital lista as disciplinas como se pesassem igual. Não pesam",
    corpo: [
      "O conteúdo programático apresenta 18 disciplinas em sequência, sem indicar peso. Quem estuda nessa ordem gasta o mesmo tempo em Filosofia do Direito, que costuma render duas questões, e em Direito Civil, que rende sete.",
      "A distribuição real da prova é pública — está em cada caderno já aplicado. É por isso que ela fica aberta aqui: saber o que mais cai não é vantagem competitiva de curso nenhum, é informação que deveria estar na frente de todo estudante antes da primeira semana de estudo.",
    ],
  },
  {
    titulo: "Muita questão se resolve na lei seca",
    corpo: [
      "Uma parcela relevante das questões objetivas é resolvida por quem simplesmente conhece o dispositivo. Não é doutrina, não é jurisprudência divergente: é o texto do artigo, aplicado a um caso concreto curto.",
      "Isso tem uma consequência prática pouco explorada: ler a lei comentada rende mais ponto por hora do que assistir aula sobre a lei. Toda a legislação comentada do OABase é aberta exatamente por isso — é a parte do estudo que não deveria estar atrás de paywall.",
    ],
  },
  {
    titulo: "Cinco horas para 80 questões são 3min45 por questão",
    corpo: [
      "A prova dura cinco horas, das 13h às 18h. Dividido por 80, dá três minutos e quarenta e cinco segundos por questão — incluindo os enunciados longos, com caso concreto de dez linhas, que a FGV usa cada vez mais.",
      "Na prática isso significa que travar em uma questão é caro. A técnica que funciona é a mais simples: marcar, pular, voltar no fim. E treinar cronometrado antes, porque a sensação de tempo em casa, sem pressão, não é a mesma da sala de prova.",
    ],
  },
  {
    titulo: "Questão anulada acontece, e faz parte da conta",
    corpo: [
      "No 43º Exame, duas das 80 questões foram anuladas no gabarito definitivo. Não é raro nem excepcional: a banca publica gabarito preliminar, abre prazo de recurso e depois publica o definitivo, com anulações e eventuais mudanças de resposta.",
      "Por isso o banco do OABase guarda a anulação como informação, e não descarta a questão: ela sai dos simulados, mas continua servindo de estudo — e o histórico de anulações diz muito sobre onde a própria banca considera que se expressou mal.",
    ],
  },
];
const perguntas = [
  {
    q: "O conteúdo aberto é mesmo aberto, ou tem limite de leitura?",
    a: "Aberto de verdade: sem cadastro, sem contador, sem tela de bloqueio depois do terceiro artigo. Legislação artigo por artigo, fichas dos exames e as estatísticas de incidência ficam livres para qualquer pessoa. O plano cobre o banco de questões e as ferramentas de treino — o que depende do seu progresso individual.",
  },
  {
    q: "Por que o plano acaba no dia da prova em vez de ser mensal?",
    a: "Porque é assim que o estudo funciona neste nicho. Você não quer uma assinatura para sempre, quer chegar preparado numa data específica. O plano “Até a prova” vai até o dia do exame que você escolher ao assinar, sem renovação automática e sem cobrança depois. Se reprovar, o plano anual cobre duas edições seguidas.",
  },
  {
    q: "As questões são as originais da FGV?",
    a: "Sim, extraídas dos cadernos oficiais publicados pela própria banca, com o gabarito definitivo — inclusive as anulações. O comentário autoral — a explicação de por que cada alternativa está certa ou errada — é escrito à mão, questão a questão, e ainda está no começo: a tela diz com todas as letras quando a questão ainda não tem comentário, em vez de preencher o espaço com texto gerado por IA.",
  },
  {
    q: "Serve para a 2ª fase?",
    a: "Ainda não. O OABase é focado na 1ª fase, que é onde a maior parte das reprovações acontece e onde o treino por questão faz mais diferença. A 2ª fase exige peça prática e questões discursivas, que pedem outro formato de correção.",
  },
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. Funciona no navegador do celular e do computador, e o progresso fica na sua conta — você pode responder questões no ônibus e continuar de onde parou em casa.",
  },
];
export default async function Home() {
  const [disciplinas, acervo, leis, proximo] = await Promise.all([
    getDisciplinas(),
    getAcervo(),
    getLeis(),
    getProximoExame(),
  ]);
  const dias = diasAte(proximo.data);
  const chamada =
    dias <= 14 ? "Foque no que mais cai." : "Dá tempo de virar o jogo.";

  // Distribuição TÍPICA, não a de uma edição: a real por exame só existe
  // quando a classificação por disciplina estiver confirmada.
  const NOMEADAS = 6;
  const cauda = disciplinas.slice(NOMEADAS);
  const grupos: Grupo[] = [
    ...disciplinas.slice(0, NOMEADAS).map((d, i) => ({
      chave: d.slug,
      nome: d.nome,
      questoes: Math.round(d.mediaPorProva),
      cor: corPorPosicao(i),
    })),
    {
      chave: "cauda",
      nome: `Outras ${cauda.length} disciplinas`,
      questoes: cauda.reduce((s, d) => s + Math.round(d.mediaPorProva), 0),
      cor: corPorPosicao(NOMEADAS),
    },
  ];
  const questoesNoBanco = acervo.questoes;
  return (
    <>
      {/*
        FAQPage e Course.

        As perguntas já estavam na página em HTML; o schema só as torna
        legíveis para o buscador, que passa a poder exibi-las direto no
        resultado. É a diferença entre ocupar uma linha e ocupar meia tela
        para a mesma posição.

        `Course` descreve o que o site é para quem procura "curso OAB 1ª
        fase". `isAccessibleForFree` fica em `false` no nível do curso porque
        o treino depende de plano — declarar grátis o que é pago é o tipo de
        marcação que rende penalidade manual.
      */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "FAQPage",
              "@id": abs("/#faq"),
              mainEntity: perguntas.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            },
            {
              "@type": "Course",
              "@id": abs("/#curso"),
              name: "Preparação para a 1ª fase do Exame de Ordem",
              description: site.description,
              inLanguage: "pt-BR",
              provider: { "@id": abs("/#organization") },
              isAccessibleForFree: false,
              educationalLevel: "Ensino superior",
              about: {
                "@type": "Thing",
                name: "Exame de Ordem dos Advogados do Brasil",
              },
              hasCourseInstance: {
                "@type": "CourseInstance",
                courseMode: "online",
                courseWorkload: "PT200H",
              },
            },
          ],
        }}
      />

      {/* ═══════════════════════ Hero ═══════════════════════ */}
      <section className="relative isolate overflow-hidden bg-noite text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-[32%] right-[-8%] h-[820px] w-[820px] rounded-full opacity-100 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(42,148,120,0.6) 0%, rgba(11,98,80,0.26) 42%, rgba(4,31,28,0) 72%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-48 opacity-80"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(5,43,38,0.9) 100%)",
          }}
        />

        <Container className="relative grid items-center gap-12 pt-14 pb-20 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16 lg:pt-20 lg:pb-24">
          <div className="flex flex-col items-start gap-8">
            <span className="inline-flex items-center gap-2 border-b border-ouro-400/60 pb-2 text-[0.78rem] font-bold tracking-[0.13em] text-ouro-200 uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-ouro-400" />
              {proximo.edicao}º Exame
              <span className="font-semibold tabular-nums text-white">
                <Contagem dataISO={proximo.data} dias={dias} />
              </span>
            </span>

            <h1 className="flex flex-col gap-5">
              <span className="max-w-[11ch] text-[clamp(3.1rem,5.6vw,5rem)] leading-[0.97] font-extrabold tracking-[-0.06em] text-white">
                Estude para passar. Não para assistir aula.
              </span>
              {/* O número sai do acervo, não de uma promessa escrita à mão:
                  "três mil" fixo já esteve na mesma tela que "1.120 questões
                  no banco", logo abaixo. E o texto não diz "comentadas"
                  enquanto o comentário de questão não existir — prometer na
                  primeira dobra o que o produto não entrega é o defeito mais
                  caro que uma landing pode ter. */}
              <span className="max-w-[34ch] text-[clamp(1.08rem,1.8vw,1.35rem)] leading-[1.45] font-medium text-brand-100">
                Comece por uma questão oficial. Depois, avance pelas{" "}
                <span className="text-ouro-200 underline decoration-ouro-400/60 decoration-2 underline-offset-4">
                  {questoesNoBanco.toLocaleString("pt-BR")}
                </span>{" "}
                — todas com o gabarito oficial da FGV.
              </span>
            </h1>

            <p className="max-w-[46ch] text-[1.02rem] leading-relaxed text-brand-200">
              Ao lado está a questão 65 do 43º Exame, com o gabarito definitivo
              da FGV. Sem cadastro: clique numa alternativa e veja o comentário.
            </p>

            {/* `flex-1` com base igual: os dois botões têm rótulos de
                comprimentos bem diferentes, e dimensionados pelo conteúdo
                ficavam um curto e um longo, empilhados e desalinhados. Assim
                dividem a linha quando cabem e ocupam a mesma largura quando
                quebram. */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="#planos"
                className="flex-1 basis-60 rounded-full bg-ouro-400 px-7 py-3.5 text-center font-semibold text-noite shadow-[0_14px_30px_-14px_rgba(233,162,59,0.9)] transition-all hover:-translate-y-0.5 hover:bg-ouro-200"
              >
                Começar por R$&nbsp;1
              </Link>
              <Link
                href="#guia"
                className="flex-1 basis-60 rounded-full border border-white/30 bg-white/5 px-7 py-3.5 text-center font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-white/60 hover:bg-white hover:text-brand-800"
              >
                Como se aprova na 1ª fase
              </Link>
            </div>

            <dl className="mt-2 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-white/15 pt-5 text-[0.92rem]">
              {[
                [questoesNoBanco.toLocaleString("pt-BR"), "questões no banco"],
                [`${acervo.exames}`, "exames ingeridos"],
                ["FGV", "gabarito oficial"],
              ].map(([valor, rotulo]) => (
                <div key={rotulo} className="flex items-baseline gap-2">
                  <dd className="text-[1.1rem] font-bold tabular-nums text-ouro-200">
                    {valor}
                  </dd>
                  <dt className="text-brand-200">{rotulo}</dt>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-[560px] lg:mx-0 lg:max-w-none">
            <div aria-hidden="true" className="absolute -top-7 -right-5 h-40 w-40 rounded-full border border-ouro-400/40 bg-ouro-400/10 sm:-right-10 sm:h-56 sm:w-56" />
            <div className="relative z-10 overflow-hidden rounded-[30px] border border-white/20 bg-white p-1.5 shadow-[0_35px_80px_-30px_rgba(0,0,0,0.7)] sm:p-2">
              <div className="flex items-center justify-between border-b border-line px-4 py-3 text-[0.74rem] font-bold tracking-[0.1em] text-brand-700 uppercase">
                <span>Teste antes de assinar</span>
                <span className="text-ouro-600">questão oficial</span>
              </div>
              <QuestaoVitrine />
            </div>
          </div>
        </Container>
      </section>

      {/* ═══════════════ A 1ª fase em números ═══════════════ */}
      <section className="relative overflow-hidden bg-ouro-400 py-16">
        <Container className="flex flex-col gap-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-[1.65rem] font-extrabold tracking-[-0.04em] text-noite">
              A prova é objetiva. Seu estudo também precisa ser.
            </h2>
            <p className="text-[0.94rem] text-noite/70">
              Tudo do edital e dos cadernos aplicados — nada é estimativa
            </p>
          </div>

          <dl className="grid border-t border-noite/20 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["80", "questões objetivas", "quatro alternativas, uma correta"],
              ["40", "acertos para aprovar", "exatamente metade da prova"],
              ["5h", "de duração", "das 13h às 18h, horário de Brasília"],
              ["3min45", "por questão", "incluindo os enunciados longos"],
              ["18", "disciplinas cobradas", "com pesos muito diferentes"],
              [
                questoesNoBanco.toLocaleString("pt-BR"),
                "questões no acervo",
                `de ${acervo.exames} exames já ingeridos`,
              ],
            ].map(([valor, rotulo, nota]) => (
              <div key={rotulo} className="border-b border-noite/20 p-6 sm:border-r lg:[&:nth-child(3n)]:border-r-0">
                <dd className="text-[2.7rem] leading-none font-extrabold tracking-[-0.05em] text-noite tabular-nums">
                  {valor}
                </dd>
                <dt className="mt-2 font-semibold text-noite">{rotulo}</dt>
                <dd className="mt-0.5 text-[0.88rem] text-noite/65">{nota}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* ═══════════════ A forma da prova ═══════════════ */}
      <section className="bg-paper py-24">
        <Container className="grid gap-14 lg:grid-cols-[1fr_1fr] lg:items-center">
          <Reveal className="flex flex-col gap-6">
            <span className="text-[0.78rem] font-bold tracking-[0.13em] text-ouro-600 uppercase">Distribuição da prova</span>
            <h2 className="max-w-[13ch] text-[clamp(2.3rem,4.2vw,3.45rem)] leading-[1] font-extrabold tracking-[-0.05em]">
              A prova tem padrão. Use isso a seu favor.
            </h2>
            <div className="flex max-w-[54ch] flex-col gap-4 text-body">
              <p>
                Ao lado estão as 80 questões de uma prova típica, uma célula
                cada, agrupadas por disciplina e ordenadas por peso. O brilho é
                a incidência: as disciplinas que dominam a prova acendem, a
                cauda longa recua. Passe o mouse na legenda para acender um
                bloco.
              </p>
              <p>
                O que esse desenho mostra é a coisa mais útil que existe para
                quem está começando: a prova não é uma loteria de 18 disciplinas
                equivalentes. Seis delas respondem por metade das questões, e
                essa proporção se repete edição após edição, com variação de uma
                ou duas questões para mais ou para menos.
              </p>
              <p>
                Isso não significa ignorar o resto — significa saber em que
                ordem atacar, e onde vale aprofundar em vez de apenas
                reconhecer.
              </p>
            </div>
            <Link
              href="/estatisticas"
              className="self-start border-b-2 border-ouro-400 pb-1 font-semibold text-brand-700 transition-colors hover:border-brand-600"
            >
              Ver a distribuição de todas as disciplinas
            </Link>
          </Reveal>

          <div
            className="rounded-[32px] border border-brand-700/50 p-7 shadow-[0_30px_60px_-25px_rgba(4,31,28,0.5)] sm:p-9"
            style={{
              background:
                "linear-gradient(155deg, #0B6250 0%, #073B33 55%, #052B26 100%)",
            }}
          >
            <CartaoResposta grupos={grupos} />
          </div>
        </Container>
      </section>

      {/* ═══════════════ O ciclo ═══════════════ */}
      <section className="bg-brand-800 py-24 text-white">
        <Container className="flex flex-col gap-12">
          <Reveal className="flex max-w-[56ch] flex-col gap-5">
            <span className="text-[0.78rem] font-bold tracking-[0.13em] text-ouro-200 uppercase">O ciclo</span>
            <h2 className="text-[clamp(2.25rem,4.2vw,3.4rem)] leading-[1] font-extrabold tracking-[-0.05em] text-white">
              Ler não reprova ninguém. Errar e não voltar, sim.
            </h2>
            <p className="text-brand-100">
              Quase todo mundo que reprova estudou. O que costuma faltar não é
              conteúdo, é o circuito fechado entre errar, registrar o erro e
              voltar nele na hora certa. É esse circuito que o plano automatiza.
            </p>
          </Reveal>

          <ol className="grid gap-5 lg:grid-cols-3">
            {metodo.map((passo, i) => (
              <li
                key={passo.titulo}
                className="flex flex-col gap-4 border-t border-brand-300/50 pt-6 lg:border-t-0 lg:border-l lg:pl-8 lg:first:pl-0 lg:first:border-l-0"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ouro-400 text-[0.9rem] font-bold text-noite">
                  {i + 1}
                </span>
                <h3 className="text-[1.5rem] font-bold text-white">
                  {passo.titulo}
                </h3>
                <p className="text-[0.95rem] leading-relaxed text-brand-100">
                  {passo.texto}
                </p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ═══════════════ Guia editorial ═══════════════ */}
      <section id="guia" className="scroll-mt-24 bg-surface py-24">
        <Container className="flex flex-col gap-14">
          <Reveal className="flex max-w-[58ch] flex-col gap-5">
            <span className="text-[0.78rem] font-bold tracking-[0.13em] text-ouro-600 uppercase">Guia</span>
            <h2 className="text-[clamp(2.3rem,4.2vw,3.45rem)] leading-[1] font-extrabold tracking-[-0.05em]">
              Como se aprova na 1ª fase
            </h2>
            <p className="text-body">
              Seis coisas que mudam o resultado. Nenhuma é segredo — todas saem
              da leitura fria do edital e dos cadernos já aplicados. E quase
              nenhuma aparece no primeiro mês de estudo.
            </p>
          </Reveal>

          <div className="grid gap-x-12 gap-y-0 lg:grid-cols-2">
            {guia.map((item, i) => (
              <article
                key={item.titulo}
                className="flex flex-col gap-3.5 border-t border-line py-8 first:border-t-2 first:border-ink"
              >
                <span className="text-[0.88rem] font-bold tracking-[0.1em] text-ouro-600 tabular-nums">
                  0{i + 1}
                </span>
                <h3 className="max-w-[26ch] text-[1.35rem] leading-[1.2] font-bold text-ink">
                  {item.titulo}
                </h3>
                {item.corpo.map((p) => (
                  <p
                    key={p}
                    className="max-w-[58ch] text-[0.95rem] leading-relaxed text-body"
                  >
                    {p}
                  </p>
                ))}
              </article>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══════════════ A fronteira aberto / pago ═══════════════ */}
      <section className="bg-paper py-24">
        <Container className="flex flex-col gap-12">
          <Reveal className="flex max-w-[54ch] flex-col gap-5">
            <span className="text-[0.78rem] font-bold tracking-[0.13em] text-ouro-600 uppercase">Como o OABase se divide</span>
            <h2 className="text-[clamp(2.3rem,4.2vw,3.45rem)] leading-[1] font-extrabold tracking-[-0.05em]">
              Consultar é grátis. Treinar é o plano.
            </h2>
            <p className="text-body">
              Tudo que serve para consultar fica aberto e sem cadastro. O que
              depende do seu progresso — e é o que de fato aprova — fica no
              plano.
            </p>
          </Reveal>

          <div className="grid overflow-hidden rounded-[30px] border border-line bg-surface shadow-[var(--shadow-media)] lg:grid-cols-2">
            <div className="flex flex-col gap-5 bg-brand-50 p-8 sm:p-10">
              <div className="flex items-center justify-between gap-4">
                <span className="selo bg-white/70">Aberto</span>
                <span className="text-[0.86rem] text-brand-700/70">
                  {" "}
                  sem cadastro
                </span>
              </div>
              <h3 className="text-[1.6rem] font-bold text-brand-800">
                Todo o material de consulta
              </h3>
              <ul className="flex flex-col divide-y divide-brand-100">
                {[
                  ...leis.map((l) => [
                    `/legislacao/${l.slug}`,
                    `${l.nome} comentada`,
                  ]),
                  ["/exames", "Fichas e gabaritos dos exames"],
                  [
                    "/estatisticas",
                    "O que mais cai, disciplina por disciplina",
                  ],
                ].map(([href, rotulo]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="group flex items-baseline gap-4 py-3.5 text-[0.96rem]"
                    >
                      <span className="text-brand-800/85 group-hover:text-brand-800">
                        {rotulo}
                      </span>
                      <span className="ml-auto text-brand-500 opacity-45 transition-opacity group-hover:opacity-100">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-5 border-t border-line bg-vinho-50 p-8 sm:p-10 lg:border-t-0 lg:border-l">
              <div className="flex items-center justify-between gap-4">
                <span className="selo bg-white/70 text-vinho-600">
                  No plano
                </span>
                <span className="text-[0.86rem] text-vinho-600/70">
                  R$ 109 até a prova
                </span>
              </div>
              <h3 className="text-[1.6rem] font-bold text-vinho-700">
                Tudo que depende do seu erro
              </h3>
              <ul className="flex flex-col divide-y divide-vinho-100">
                {[
                  /* Não "comentadas": `comentarios` está vazia. O que o plano
                     entrega hoje é o acervo inteiro liberado para treino. */
                  "Banco completo de questões, com gabarito oficial",
                  "Simulados cronometrados de 80 questões",
                  "Caderno de erros automático",
                  "Revisão espaçada",
                  "Estatísticas de desempenho por tema",
                  "Cronograma até a data da sua prova",
                ].map((item) => (
                  <li
                    key={item}
                    className="py-3.5 text-[0.96rem] text-vinho-700/85"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* ═══════════════ Perguntas ═══════════════ */}
      <section className="bg-surface py-24">
        <Container className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
          <Reveal className="flex flex-col gap-5">
            <span className="text-[0.78rem] font-bold tracking-[0.13em] text-ouro-600 uppercase">Perguntas</span>
            <h2 className="max-w-[11ch] text-[clamp(2.3rem,4.2vw,3.45rem)] leading-[1] font-extrabold tracking-[-0.05em]">
              O que costumam perguntar
            </h2>
          </Reveal>

          <dl className="flex flex-col">
            {perguntas.map((item) => (
              <div key={item.q} className="flex flex-col gap-2 border-t border-line py-6 first:border-t-2 first:border-ink">
                <dt className="text-[1.18rem] font-bold text-ink">{item.q}</dt>
                <dd className="max-w-[66ch] text-[0.95rem] leading-relaxed text-body">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* ═══════════════ Planos ═══════════════ */}
      <section id="planos" className="scroll-mt-24 pb-24">
        <Container>
          <div
            className="relative overflow-hidden rounded-[32px] p-8 shadow-[var(--shadow-alta)] sm:p-12 lg:p-14"
            style={{
              background:
                "linear-gradient(150deg, #0B6250 0%, #073B33 52%, #052B26 100%)",
            }}
          >
            <div className="flex flex-col items-start gap-5">
              <span className="selo selo-claro">
                <span className="h-1.5 w-1.5 rounded-full bg-ouro-400" />
                Planos
                <span className="font-semibold tabular-nums">
                  <Contagem dataISO={proximo.data} dias={dias} />
                </span>
              </span>
              <h2 className="max-w-[17ch] text-[clamp(2rem,4.4vw,3.1rem)] leading-[1.06] font-extrabold tracking-[-0.035em] text-white">
                Faltam {dias}&nbsp;dias. {chamada}
              </h2>
              <p className="max-w-[52ch] text-[1.02rem] text-brand-100">
                Toda a legislação comentada, as estatísticas e o guia acima
                continuam abertos. O plano libera o banco de questões e as
                ferramentas de treino — e dura até o dia da sua prova.
              </p>
            </div>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-6 -right-6 hidden h-[190px] w-[190px] opacity-95 lg:block"
            >
              <div
                className="isolate flex h-full w-full items-center justify-center overflow-hidden rounded-full p-6"
                style={{
                  background:
                    "linear-gradient(150deg, #FAE9CC 0%, #EBF5F1 60%, #CFE8DF 100%)",
                }}
              >
                <Image
                  src="/mascote.jpg"
                  alt=""
                  width={420}
                  height={420}
                  sizes="190px"
                  className="mix-blend-multiply"
                />
              </div>
            </div>

            <div className="mt-11 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {planos.map((plano) => (
                <div
                  key={plano.chave}
                  // A borda transparente no cartão em destaque não é enfeite:
                  // sem ela o cartão mede 2px a menos que os vizinhos e todo
                  // o conteúdo dele — preço, itens, botão — desce 1px.
                  className={`flex flex-col gap-5 rounded-[18px] border p-7 ${
                    plano.destaque
                      ? "border-transparent bg-surface"
                      : "border-white/15 bg-white/[0.06]"
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <span
                      className={`text-[0.9rem] font-semibold ${plano.destaque ? "text-vinho-500" : "text-brand-100"}`}
                    >
                      {plano.nome}
                    </span>
                    <span
                      className={`text-[2.5rem] leading-none font-extrabold tracking-[-0.04em] ${plano.destaque ? "text-ink" : "text-white"}`}
                    >
                      {plano.preco}
                    </span>
                    <span
                      className={`text-[0.88rem] ${plano.destaque ? "text-muted" : "text-brand-200"}`}
                    >
                      {plano.periodo}
                    </span>
                  </div>

                  <ul
                    className={`flex flex-1 flex-col gap-2.5 border-t pt-5 ${plano.destaque ? "border-line" : "border-white/15"}`}
                  >
                    {plano.itens.slice(0, 3).map((item) => (
                      <li
                        key={item}
                        className={`text-[0.9rem] ${plano.destaque ? "text-body" : "text-brand-100"}`}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={`/app/assinar?plano=${plano.chave}`}
                    // Altura fixa em vez de `py`: "Assinar até a prova" e
                    // "Começar por R$ 1" quebram em duas linhas na largura do
                    // cartão, e com padding vertical o botão que quebra fica
                    // mais alto que o vizinho. A altura comporta as duas
                    // linhas, então quebrar deixa de mudar o tamanho.
                    className={`flex min-h-[3.4rem] items-center justify-center rounded-full px-4 text-center text-[0.94rem] leading-tight font-semibold transition-colors ${
                      plano.destaque
                        ? "bg-brand-600 text-white hover:bg-brand-700"
                        : "border border-white/25 text-white hover:bg-white hover:text-brand-800"
                    }`}
                  >
                    {plano.cta}
                  </Link>
                </div>
              ))}
            </div>

            <p className="mt-7 text-[0.88rem] text-brand-200">
              Pix ou cartão · sem fidelidade ·{" "}
              <Link
                href="/precos"
                className="text-white underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white"
              >
                {" "}
                comparar os planos em detalhe
              </Link>
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
