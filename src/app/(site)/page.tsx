import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/container";
import { FilmeLancamento } from "@/components/filme-lancamento";
import { Reveal } from "@/components/reveal";
import { diasAte, getAcervo, getExames, getLeis, getProximoExame } from "@/lib/content/queries";
import { JsonLd } from "@/lib/jsonld";
import { planosDisponiveis } from "@/lib/planos";
import { abs, site } from "@/lib/site";

export const revalidate = 3600;

const jornadas = [
  {
    numero: "1",
    titulo: "Diga o que precisa estudar",
    texto: "Escolha as matérias, informe a data da avaliação ou traga a ementa. O ponto de partida é a sua prova — não um cronograma genérico.",
  },
  {
    numero: "2",
    titulo: "Transforme conteúdo em blocos",
    texto: "O roadmap distribui os tópicos dentro das horas que você realmente tem e mostra o próximo passo sem esconder o restante do caminho.",
  },
  {
    numero: "3",
    titulo: "Estude e deixe rastros",
    texto: "Tempo de foco, metas, questões, anotações e revisões ficam ligados ao plano. Na próxima sessão, você continua — não recomeça.",
  },
];

const ferramentas = [
  ["Roadmap ajustável", "Organize semanas, mova blocos no calendário e replaneje o que ficou para trás sem apagar o progresso."],
  ["Sessões com direção", "Abra um bloco, defina o tempo e estude com objetivo, materiais e checklist no mesmo lugar."],
  ["Caderno de lei seca", "Leia legislação na fonte, destaque trechos e registre notas ligadas ao dispositivo certo."],
  ["Revisão que volta", "Flashcards e erros reaparecem no momento de revisar, com o histórico preservado."],
  ["Provas da faculdade", "Monte um plano regressivo por disciplina, data, tópicos e dificuldade percebida."],
  ["Preparação para a OAB", "Treine com questões oficiais da 1ª fase, gabaritos da FGV, simulados e incidência medida."],
] as const;

type Amostra = { edicao: number; questoes: number } | null;

function perguntasDaHome(amostra: Amostra) {
  return [
  ...(amostra
    ? [
        {
          q: `O ${amostra.edicao}º Exame é grátis mesmo?`,
          a: `É. As ${amostra.questoes} questões do ${amostra.edicao}º Exame de Ordem ficam abertas para qualquer conta, sem plano e sem cartão, com gabarito oficial da FGV e comentário em cada uma. Não há período de teste que vira cobrança: os outros exames e o simulado cronometrado é que fazem parte do plano.`,
        },
      ]
    : []),
  {
    q: "O OABase serve para prova da faculdade?",
    a: "Sim. Você pode escolher uma disciplina, cadastrar os tópicos da avaliação, informar a data e a sua disponibilidade. O sistema transforma isso em um roadmap de estudo e acompanha a execução até a prova.",
  },
  {
    q: "Preciso estar estudando para a OAB?",
    a: "Não. A OAB é uma das jornadas disponíveis, com recursos próprios como questões oficiais e estatísticas da 1ª fase. O planejamento, o calendário, as sessões de foco, as metas e as anotações também servem para a graduação.",
  },
  {
    q: "Posso usar uma ementa da minha faculdade?",
    a: "Pode. Você revisa os tópicos extraídos antes de gerar qualquer plano. Também é possível montar a avaliação manualmente quando você já tem a lista do professor.",
  },
  {
    q: "O conteúdo jurídico é gerado por IA?",
    a: "Não. A IA organiza tempo e tópicos; ela não ensina Direito. Legislação e súmulas vêm de fontes oficiais, e comentários jurídicos são trabalho autoral revisado.",
  },
  {
    q: "O que continua aberto sem cadastro?",
    a: "A consulta de legislação, súmulas, glossário, exames, estatísticas e textos do blog continua aberta. A conta guarda o que é seu: planos, progresso, foco, notas e revisões — e é ela que libera a prova grátis.",
  },
  {
    q: "E a 2ª fase da OAB?",
    a: "O roadmap pode organizar sua rotina, mas o banco de questões e os simulados são voltados à 1ª fase. Correção de peças e respostas discursivas ainda não faz parte do produto.",
  },
  ];
}

/* Um tamanho de título para a página inteira: a escala é o que dá a
   sensação de calma, e cada seção com o seu tamanho desfaz isso. */
const titulo = "text-[clamp(2.5rem,5.6vw,4.6rem)] leading-[1.02] font-bold tracking-[-0.048em]";
const sobretitulo = "text-[clamp(1.05rem,1.6vw,1.3rem)] font-semibold tracking-[-0.01em]";

function Chevron() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
      <path d="m4.5 2.5 3.5 3.5-3.5 3.5" />
    </svg>
  );
}

function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={`h-5 w-5 shrink-0 ${claro ? "text-brand-300" : "text-brand-500"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 10.5 3.2 3L15 6.5" />
    </svg>
  );
}

/**
 * O aparelho do topo: a tela de questões como ela é — enunciado, quatro
 * alternativas, o cartão-resposta ao lado. O enunciado é desenhado em
 * barras: questão de verdade só sai do banco para quem está logado (RLS),
 * e esta página é aberta.
 */
function AparelhoDaProva({ edicao, total }: { edicao: number; total: number }) {
  const alternativas = [
    ["A", "w-[78%]", ""],
    ["B", "w-[64%]", "certa"],
    ["C", "w-[86%]", ""],
    ["D", "w-[58%]", ""],
  ] as const;
  const casas = Array.from({ length: Math.min(total, 80) }, (_, i) =>
    i === 0 ? "atual" : i < 27 ? (i % 7 === 3 ? "erro" : "certa") : "vazia",
  );

  return (
    <div className="home-zoom relative mx-auto w-full max-w-[1040px]" aria-hidden="true">
      <div className="rounded-[34px] bg-[#0d1312] p-[10px] shadow-[0_0_0_1px_rgba(16,32,27,.08),0_50px_100px_-30px_rgba(4,31,28,.45)] sm:rounded-[44px] sm:p-[14px]">
        <div className="overflow-hidden rounded-[26px] bg-paper sm:rounded-[32px]">
          <div className="flex items-center justify-center border-b border-line bg-surface/80 px-4 py-2.5">
            <span className="rounded-full bg-sunk px-4 py-1 text-[0.7rem] font-medium text-muted">oabase.com.br/app/questoes</span>
          </div>
          <div className="grid gap-5 p-4 text-left sm:p-7 md:grid-cols-[1fr_250px]">
            <div className="rounded-[20px] bg-surface p-5 shadow-[var(--shadow-baixa)] sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[0.66rem] font-bold tracking-[0.12em] text-brand-600 uppercase">{edicao}º Exame de Ordem</span>
                  <strong className="mt-1 block text-[1.15rem] font-bold text-ink sm:text-[1.3rem]">Questão 1 de {total}</strong>
                </div>
                <span className="rounded-full bg-ouro-100 px-3 py-1.5 text-[0.68rem] font-bold text-ouro-700">grátis</span>
              </div>
              <div className="mt-5 flex flex-col gap-2">
                {["w-full", "w-[94%]", "w-[71%]"].map((w) => (
                  <span key={w} className={`block h-2.5 rounded-full bg-sunk ${w}`} />
                ))}
              </div>
              <ol className="mt-5 flex flex-col gap-2">
                {alternativas.map(([letra, w, estado]) => (
                  <li key={letra} className={`flex items-center gap-3 rounded-[14px] border p-3 ${estado ? "border-brand-200 bg-brand-50" : "border-line bg-white"}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-[0.72rem] font-bold ${estado ? "bg-brand-600 text-white" : "bg-sunk text-muted"}`}>{letra}</span>
                    <span className={`block h-2 rounded-full ${estado ? "bg-brand-200" : "bg-sunk"} ${w}`} />
                  </li>
                ))}
              </ol>
              <div className="mt-4 rounded-[14px] bg-paper p-4">
                <span className="text-[0.66rem] font-bold tracking-[0.12em] text-brand-600 uppercase">Gabarito B · comentário</span>
                <div className="mt-3 flex flex-col gap-2">
                  {["w-full", "w-[82%]"].map((w) => (
                    <span key={w} className={`block h-2 rounded-full bg-sunk ${w}`} />
                  ))}
                </div>
              </div>
            </div>
            <div className="hidden flex-col gap-4 md:flex">
              <div className="rounded-[20px] bg-surface p-5 shadow-[var(--shadow-baixa)]">
                <span className="rotulo">Cartão-resposta</span>
                <div className="mt-4 grid grid-cols-8 gap-1.5">
                  {casas.map((estado, i) => (
                    <span
                      key={i}
                      className={`aspect-square rounded-[5px] ${
                        estado === "atual" ? "bg-ink" : estado === "certa" ? "bg-brand-300" : estado === "erro" ? "bg-vinho-200" : "bg-sunk"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-[20px] bg-noite p-5 text-white">
                <span className="rotulo rotulo-claro">Caderno de erros</span>
                <strong className="mt-2 block text-[1.05rem] leading-snug font-semibold">O que você errou volta na revisão.</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="auth-flutua absolute top-[22%] -left-6 hidden rounded-[18px] border border-line bg-surface/90 px-4 py-3 shadow-[var(--shadow-alta)] backdrop-blur lg:block">
        <span className="block text-[0.68rem] text-muted">Gabarito</span>
        <strong className="text-[0.85rem] text-ink">oficial da FGV</strong>
      </div>
      <div className="auth-flutua-atrasada absolute -right-6 bottom-[18%] hidden rounded-[18px] bg-ink px-4 py-3 text-white shadow-[var(--shadow-alta)] lg:block">
        <span className="block text-[0.68rem] text-brand-200">Errou?</span>
        <strong className="text-[0.85rem]">volta amanhã</strong>
      </div>
    </div>
  );
}

/* As miniaturas da grade de ferramentas, na mesma ordem de `ferramentas`.
   Desenho, não captura de tela: captura envelhece a cada ajuste de interface. */
function Miniatura({ indice }: { indice: number }): ReactNode {
  switch (indice) {
    case 0:
      return (
        <div className="flex flex-col gap-2.5">
          {[
            ["Seg", "ml-0 w-[42%]", "bg-brand-400"],
            ["Ter", "ml-[18%] w-[36%]", "bg-brand-300"],
            ["Qua", "ml-[30%] w-[48%]", "bg-ouro-400"],
            ["Qui", "ml-[52%] w-[30%]", "bg-brand-200"],
          ].map(([dia, pos, cor]) => (
            <div key={dia} className="flex items-center gap-3">
              <span className="w-8 text-[0.7rem] font-semibold text-muted">{dia}</span>
              <div className="h-7 flex-1 rounded-full bg-sunk">
                <span className={`block h-full rounded-full ${pos} ${cor}`} />
              </div>
            </div>
          ))}
        </div>
      );
    case 1:
      return (
        <div className="flex justify-center">
          <div className="relative flex h-32 w-32 items-center justify-center rounded-full" style={{ background: "conic-gradient(var(--color-brand-400) 0 68%, var(--color-sunk) 68% 100%)" }}>
            <div className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full bg-surface">
              <strong className="text-[1.6rem] font-bold tracking-[-0.04em] text-ink tabular-nums">16:24</strong>
              <span className="text-[0.66rem] text-muted">foco</span>
            </div>
          </div>
        </div>
      );
    case 2:
      return (
        <p className="font-lei text-[1.02rem] leading-relaxed text-ink">
          <span className="font-sans text-[0.7rem] font-bold tracking-[0.1em] text-brand-600 uppercase">Art. 5º </span>
          Todos são iguais perante a lei, <span className="grifo">sem distinção de qualquer natureza</span>…
        </p>
      );
    case 3:
      return (
        <div className="relative mx-auto h-32 w-full max-w-[220px]">
          {[2, 1, 0].map((n) => (
            <div
              key={n}
              className="absolute inset-x-0 rounded-[16px] border border-line bg-surface p-4 shadow-[var(--shadow-baixa)]"
              style={{ top: n * 12, transform: `scale(${1 - n * 0.06})`, opacity: 1 - n * 0.25 }}
            >
              <span className="text-[0.66rem] font-bold tracking-[0.1em] text-vinho-600 uppercase">Revisar hoje</span>
              <span className="mt-2.5 block h-2 w-[85%] rounded-full bg-sunk" />
              <span className="mt-2 block h-2 w-[60%] rounded-full bg-sunk" />
            </div>
          ))}
        </div>
      );
    case 4:
      return (
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 21 }, (_, i) => (
            <span
              key={i}
              className={`flex aspect-square items-center justify-center rounded-[8px] text-[0.62rem] font-semibold ${
                i === 18 ? "bg-vinho-600 text-white" : i < 11 ? "bg-brand-100 text-brand-700" : "bg-sunk text-muted"
              }`}
            >
              {i + 1}
            </span>
          ))}
        </div>
      );
    default:
      return null;
  }
}

export default async function Home() {
  const [acervo, leis, exames, proximo] = await Promise.all([
    getAcervo(),
    getLeis(),
    getExames(),
    getProximoExame(),
  ]);
  // A oferta é o exame que a RLS de fato abre (`exames.amostra_gratuita`):
  // trocar a amostra é um UPDATE, e o texto acompanha. Sem amostra, a home
  // volta a vender o plano — não promete prova que o banco não dá.
  const exameGratis = exames.find((e) => e.amostraGratuita && e.questoesCarregadas > 0);
  const amostra: Amostra = exameGratis
    ? { edicao: exameGratis.edicao, questoes: exameGratis.questoesCarregadas }
    : null;
  const perguntas = perguntasDaHome(amostra);
  const dias = diasAte(proximo.data);
  const destinoPrincipal = amostra ? "/criar-conta?proximo=/app/questoes" : "/criar-conta";
  const rotuloPrincipal = amostra ? `Fazer o ${amostra.edicao}º grátis` : "Criar meu plano";

  // Só número que a página consegue contar. Literal de acervo envelhece no
  // dia da próxima carga.
  const numeros = [
    { valor: acervo.questoes.toLocaleString("pt-BR"), legenda: "questões oficiais da 1ª fase" },
    { valor: String(acervo.exames), legenda: "exames de ordem, com gabarito da FGV" },
    { valor: String(leis.length), legenda: "leis no texto oficial do Planalto" },
    ...(dias > 0 ? [{ valor: String(dias), legenda: `dias para o ${proximo.edicao}º Exame` }] : []),
  ];

  return (
    <>
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
              "@type": "SoftwareApplication",
              "@id": abs("/#produto"),
              name: site.name,
              description: site.description,
              applicationCategory: "EducationalApplication",
              operatingSystem: "Web",
              inLanguage: "pt-BR",
              offers: { "@type": "Offer", price: "1", priceCurrency: "BRL" },
              audience: { "@type": "EducationalAudience", educationalRole: "student" },
              featureList: ferramentas.map(([nome]) => nome),
            },
          ],
        }}
      />

      {/* ───── Abertura ───── */}
      <section className="relative isolate overflow-hidden bg-surface">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] bg-[radial-gradient(60%_50%_at_50%_0%,var(--color-brand-50),transparent_70%)]" />
        <Container className="flex flex-col items-center pt-16 text-center sm:pt-24">
          <span className={`home-entrada ${sobretitulo} text-brand-600`}>
            {amostra ? `${amostra.edicao}º Exame de Ordem` : "Da primeira prova à OAB"}
          </span>
          <h1 className="home-entrada home-atraso-1 mt-4 text-[clamp(2.9rem,8.2vw,6.8rem)] leading-[0.98] font-bold tracking-[-0.055em] text-ink">
            {amostra ? (
              <>
                A prova da OAB.
                <br />
                <span className="home-gradiente-claro">Inteira. De graça.</span>
              </>
            ) : (
              <>
                Direito se estuda
                <br />
                <span className="home-gradiente-claro">com direção.</span>
              </>
            )}
          </h1>
          <p className="home-entrada home-atraso-2 mt-7 max-w-[46ch] text-[clamp(1.08rem,1.8vw,1.35rem)] leading-relaxed text-body">
            {amostra
              ? `${amostra.questoes} questões oficiais do ${amostra.edicao}º Exame, com gabarito da FGV e comentário em cada uma. Depois, um plano que cabe na sua rotina até o dia da prova.`
              : "Transforme a matéria da faculdade, a próxima avaliação ou a preparação para a OAB em um plano que cabe na sua rotina."}
          </p>
          <div className="home-entrada home-atraso-3 mt-9 flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
            <Link href={destinoPrincipal} className="flex min-h-12 items-center justify-center rounded-full bg-brand-600 px-8 text-[1.02rem] font-semibold text-white shadow-[0_14px_30px_-14px_rgba(11,98,80,.9)] transition-all hover:scale-[1.03] hover:bg-brand-700">
              {rotuloPrincipal}
            </Link>
            <Link href={amostra ? "/prova-gratis" : "#como-funciona"} className="flex items-center gap-1.5 text-[1.02rem] font-medium text-brand-600 hover:underline">
              Como funciona <Chevron />
            </Link>
          </div>
          <p className="home-entrada home-atraso-3 mt-5 text-[0.84rem] text-muted">
            Conta gratuita · sem cartão · entra com o Google
          </p>
        </Container>
        <Container className="mt-16 pb-20 sm:mt-20 sm:pb-28">
          {amostra ? <AparelhoDaProva edicao={amostra.edicao} total={amostra.questoes} /> : null}
          <p className="mt-12 text-center">
            <Link href="/como-estudar-para-oab" className="inline-flex items-center gap-1.5 text-[0.95rem] font-medium text-brand-600 hover:underline">
              Leia o guia: como estudar para a OAB <Chevron />
            </Link>
          </p>
        </Container>
      </section>

      {/* ───── Números ───── */}
      <section className="relative isolate overflow-hidden bg-noite py-28 text-white sm:py-36">
        <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -z-10 h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[120px]" />
        <Container className="text-center">
          <Reveal>
            <h2 className={`${titulo} text-white`}>
              Contado. <span className="home-gradiente">Não chutado.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-[52ch] text-[1.1rem] leading-relaxed text-brand-100">
              Cada número desta página sai do acervo, não de estimativa. É a prova que já caiu, do jeito que caiu.
            </p>
          </Reveal>
          <dl className={`mt-20 grid gap-y-14 sm:grid-cols-2 ${numeros.length > 3 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {numeros.map((n) => (
              <div key={n.legenda} className="home-surge flex flex-col items-center px-4">
                <dd className="home-gradiente text-[clamp(3.6rem,7vw,5.6rem)] leading-none font-bold tracking-[-0.06em] tabular-nums">{n.valor}</dd>
                <dt className="mt-4 max-w-[20ch] text-[0.98rem] text-brand-100">{n.legenda}</dt>
              </div>
            ))}
          </dl>
          <Link href="/estatisticas" className="mt-16 inline-flex items-center gap-1.5 text-[1rem] font-medium text-brand-200 hover:text-white hover:underline">
            Ver o que mais cai <Chevron />
          </Link>
        </Container>
      </section>

      {/* ───── Duas jornadas ───── */}
      <section className="bg-paper py-28 sm:py-36">
        <Container>
          <Reveal className="mx-auto max-w-[24ch] text-center">
            <h2 className={`${titulo} text-ink`}>
              A faculdade e a OAB pedem ritmos diferentes. <span className="text-muted">O método acompanha os dois.</span>
            </h2>
          </Reveal>
          <div className="mt-16 grid gap-5 lg:grid-cols-2">
            <article className="home-surge flex flex-col rounded-[32px] bg-surface p-9 sm:p-12">
              <span className={`${sobretitulo} text-brand-600`}>Durante a faculdade</span>
              <h3 className="mt-3 max-w-[16ch] text-[clamp(1.8rem,3vw,2.5rem)] leading-[1.05] font-bold tracking-[-0.04em] text-ink">Uma prova por vez, sem perder o semestre de vista.</h3>
              <p className="mt-5 max-w-[46ch] leading-relaxed text-body">Cadastre a avaliação, escolha os tópicos e diga quanto tempo você tem. O roadmap monta a sequência e mantém leitura, foco e anotações ligados à disciplina.</p>
              <ul className="mt-9 flex flex-col gap-3.5 border-t border-line pt-8 text-[0.95rem] text-ink">
                {["Plano regressivo até a avaliação", "Ementa revisada antes de virar roadmap", "Metas e materiais por bloco"].map((item) => (
                  <li key={item} className="flex items-center gap-3"><Marca />{item}</li>
                ))}
              </ul>
            </article>
            <article className="home-surge flex flex-col rounded-[32px] bg-ink p-9 text-white sm:p-12">
              <span className={`${sobretitulo} text-ouro-200`}>Para o Exame de Ordem</span>
              <h3 className="mt-3 max-w-[16ch] text-[clamp(1.8rem,3vw,2.5rem)] leading-[1.05] font-bold tracking-[-0.04em] text-white">Quando a prova é nacional, os dados entram no plano.</h3>
              <p className="mt-5 max-w-[46ch] leading-relaxed text-white/70">Use a incidência das disciplinas, treine com o acervo oficial da 1ª fase e deixe o caderno de erros decidir o que precisa voltar.</p>
              <ul className="mt-9 flex flex-col gap-3.5 border-t border-white/10 pt-8 text-[0.95rem]">
                {[
                  ...(amostra ? [`${amostra.edicao}º Exame inteiro grátis, com comentário`] : []),
                  `${acervo.questoes.toLocaleString("pt-BR")} questões oficiais de ${acervo.exames} exames`,
                  "Gabaritos da FGV e anulações preservadas",
                  "Simulados e revisão espaçada",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3"><Marca claro />{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </Container>
      </section>

      {/* ───── Como funciona ───── */}
      <section id="como-funciona" className="scroll-mt-24 bg-surface py-28 sm:py-36">
        <Container>
          <Reveal className="mx-auto max-w-[20ch] text-center">
            <h2 className={`${titulo} text-ink`}>
              Menos tempo decidindo. <span className="home-gradiente-claro">Mais tempo estudando.</span>
            </h2>
          </Reveal>
          <p className="mx-auto mt-6 max-w-[50ch] text-center text-[1.1rem] leading-relaxed text-body">
            O sistema não tenta substituir professor, livro ou aula. Ele organiza a execução entre uma sessão e outra.
          </p>
          <ol className="mt-20 grid gap-12 md:grid-cols-3 md:gap-8">
            {jornadas.map((passo) => (
              <li key={passo.numero} className="home-surge text-center md:text-left">
                <span className="home-gradiente-claro text-[4.5rem] leading-none font-bold tracking-[-0.06em]">{passo.numero}</span>
                <h3 className="mt-5 text-[1.3rem] font-bold tracking-[-0.025em] text-ink">{passo.titulo}</h3>
                <p className="mx-auto mt-3 max-w-[36ch] leading-relaxed text-body md:mx-0">{passo.texto}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ───── Ferramentas ───── */}
      <section className="bg-paper py-28 sm:py-36">
        <Container>
          <Reveal className="mx-auto max-w-[22ch] text-center">
            <h2 className={`${titulo} text-ink`}>As ferramentas conversam entre si.</h2>
          </Reveal>
          <p className="mx-auto mt-6 max-w-[56ch] text-center text-[1.1rem] leading-relaxed text-body">
            O bloco do roadmap abre a sessão; a sessão registra o foco; o que ficou pendente alimenta a próxima revisão.
          </p>
          <div className="mt-16 grid gap-5 lg:grid-cols-6">
            {ferramentas.slice(0, 5).map(([nome, texto], indice) => (
              <article
                key={nome}
                className={`home-surge flex flex-col justify-between gap-10 overflow-hidden rounded-[30px] bg-surface p-8 sm:p-10 ${indice === 0 ? "lg:col-span-4" : "lg:col-span-2"}`}
              >
                <div>
                  <h3 className="text-[1.45rem] font-bold tracking-[-0.03em] text-ink">{nome}</h3>
                  <p className="mt-2.5 max-w-[44ch] text-[0.96rem] leading-relaxed text-body">{texto}</p>
                </div>
                <Miniatura indice={indice} />
              </article>
            ))}
            <article className="home-surge relative isolate flex flex-col items-start gap-6 overflow-hidden rounded-[30px] bg-noite p-8 text-white sm:p-12 lg:col-span-6 lg:flex-row lg:items-center lg:justify-between">
              <div aria-hidden="true" className="absolute -right-24 -bottom-40 -z-10 h-[420px] w-[420px] rounded-full bg-brand-500/30 blur-[100px]" />
              <div>
                <h3 className="text-[clamp(1.8rem,3.2vw,2.6rem)] leading-[1.05] font-bold tracking-[-0.04em] text-white">{ferramentas[5][0]}</h3>
                <p className="mt-3 max-w-[52ch] leading-relaxed text-white/70">{ferramentas[5][1]}</p>
              </div>
              <Link href="/exames" className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-6 py-3 text-[0.95rem] font-semibold text-ink transition-transform hover:scale-[1.03]">
                Ver os {acervo.exames} exames <Chevron />
              </Link>
            </article>
          </div>
        </Container>
      </section>

      {/* ───── Filme ───── */}
      <section className="relative isolate overflow-hidden bg-noite py-28 text-white sm:py-36">
        <div aria-hidden="true" className="pointer-events-none absolute top-1/2 left-[70%] -z-10 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/20 blur-[120px]" />
        <Container className="grid items-center gap-16 lg:grid-cols-2">
          <Reveal className="text-center lg:text-left">
            <span className={`${sobretitulo} text-ouro-200`}>O filme</span>
            <h2 className={`${titulo} mt-3 text-white`}>
              Trinta e seis segundos. <span className="home-gradiente">Sem abas abertas.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-[44ch] text-[1.1rem] leading-relaxed text-brand-100 lg:mx-0">
              Vade mecum em PDF, resumo na versão sete, cronograma abandonado. O OABase junta a prova, a lei e a revisão no mesmo lugar.
            </p>
            <Link href={destinoPrincipal} className="mt-9 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-8 font-semibold text-ink transition-transform hover:scale-[1.03]">
              {rotuloPrincipal}
            </Link>
          </Reveal>
          <FilmeLancamento />
        </Container>
      </section>

      {/* ───── Fontes ───── */}
      <section className="bg-surface py-28 sm:py-36">
        <Container className="text-center">
          <Reveal className="mx-auto max-w-[22ch]">
            <span className={`${sobretitulo} text-brand-600`}>Conteúdo com origem</span>
            <h2 className={`${titulo} mt-3 text-ink`}>
              A organização pode ser inteligente. <span className="text-muted">O Direito precisa ser verificável.</span>
            </h2>
          </Reveal>
          <p className="mx-auto mt-6 max-w-[56ch] text-[1.1rem] leading-relaxed text-body">
            A tecnologia organiza seu tempo; o conteúdo jurídico vem de ato oficial ou de comentário autoral revisado. Legislação, súmulas e glossário ficam abertos, sem cadastro.
          </p>
          <ul className="mx-auto mt-12 flex max-w-[860px] flex-wrap justify-center gap-2.5">
            {leis.slice(0, 8).map((lei) => (
              <li key={lei.slug}>
                <Link href={`/legislacao/${lei.slug}`} className="block rounded-full bg-paper px-5 py-2.5 text-[0.92rem] font-medium text-ink transition-colors hover:bg-brand-50 hover:text-brand-700">
                  {lei.nome}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3">
            <Link href="/legislacao" className="inline-flex items-center gap-1.5 font-medium text-brand-600 hover:underline">Abrir legislação <Chevron /></Link>
            <Link href="/sumulas" className="inline-flex items-center gap-1.5 font-medium text-brand-600 hover:underline">Ver súmulas <Chevron /></Link>
            <Link href="/busca" className="inline-flex items-center gap-1.5 font-medium text-brand-600 hover:underline">Buscar no acervo <Chevron /></Link>
          </div>
        </Container>
      </section>

      {/* ───── Planos ───── */}
      <section id="planos" className="scroll-mt-24 bg-paper py-28 sm:py-36">
        <Container>
          <Reveal className="mx-auto max-w-[20ch] text-center">
            <h2 className={`${titulo} text-ink`}>Comece por uma prova. <span className="text-muted">Fique pelo seu progresso.</span></h2>
          </Reveal>
          <p className="mx-auto mt-6 max-w-[56ch] text-center text-[1.1rem] leading-relaxed text-body">
            Crie a conta sem pagar{amostra ? `, resolva o ${amostra.edicao}º Exame inteiro` : ""} e escolha o período quando quiser liberar todas as ferramentas.
          </p>
          <div className="mt-16 grid gap-5 md:grid-cols-3">
            {planosDisponiveis.map((plano) => (
              <article key={plano.chave} className={`home-surge flex flex-col rounded-[30px] bg-surface p-8 sm:p-9 ${plano.destaque ? "ring-2 ring-brand-500" : ""}`}>
                <span className={`text-[1.05rem] font-semibold ${plano.destaque ? "text-brand-600" : "text-ink"}`}>{plano.nome}</span>
                <strong className="mt-4 text-[3rem] leading-none font-bold tracking-[-0.05em] text-ink">{plano.preco}</strong>
                <span className="mt-2 text-[0.88rem] text-muted">{plano.periodo}</span>
                <p className="mt-6 text-[0.95rem] leading-relaxed text-body">{plano.resumo}</p>
                <ul className="mt-6 flex flex-1 flex-col gap-3 border-t border-line pt-6 text-[0.9rem] text-ink">
                  {plano.itens.map((item) => (
                    <li key={item} className="flex gap-2.5"><Marca />{item}</li>
                  ))}
                </ul>
                <Link
                  href={`/app/assinar?plano=${plano.chave}`}
                  className={`mt-8 flex min-h-12 items-center justify-center rounded-full px-5 text-[0.95rem] font-semibold transition-colors ${plano.destaque ? "bg-brand-600 text-white hover:bg-brand-700" : "bg-sunk text-ink hover:bg-brand-50 hover:text-brand-700"}`}
                >
                  {plano.cta}
                </Link>
              </article>
            ))}
          </div>
          <p className="mt-10 text-center text-[0.9rem] text-muted">
            Pix ou cartão · sem fidelidade ·{" "}
            <Link href="/precos" className="font-medium text-brand-600 hover:underline">comparar os planos em detalhe</Link>
          </p>
        </Container>
      </section>

      {/* ───── Perguntas ───── */}
      <section id="faq" className="scroll-mt-24 bg-surface py-28 sm:py-36">
        <Container className="max-w-3xl">
          <Reveal className="text-center">
            <h2 className={`${titulo} text-ink`}>Antes de começar.</h2>
          </Reveal>
          {/* `details` e não acordeão em JS: a resposta está no HTML de
              qualquer jeito — é o que o FAQPage declara — e abre sem script. */}
          <div className="mt-14 border-t border-line">
            {perguntas.map((item) => (
              <details key={item.q} className="group border-b border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-[1.15rem] font-semibold tracking-[-0.015em] text-ink [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper text-[1.2rem] leading-none text-body transition-transform duration-300 group-open:rotate-45">+</span>
                </summary>
                <p className="max-w-[64ch] pb-7 leading-relaxed text-body">{item.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* ───── Fecho ───── */}
      <section className="relative isolate overflow-hidden bg-noite py-32 text-center text-white sm:py-44">
        <div aria-hidden="true" className="pointer-events-none absolute bottom-[-40%] left-1/2 -z-10 h-[700px] w-[1100px] -translate-x-1/2 rounded-full bg-brand-500/25 blur-[120px]" />
        <Container>
          <Reveal>
            <h2 className="text-[clamp(3rem,9vw,7.5rem)] leading-[0.95] font-bold tracking-[-0.06em] text-white">
              {amostra ? (
                <>Comece pelo <span className="home-gradiente">{amostra.edicao}º.</span></>
              ) : (
                <>Comece pela <span className="home-gradiente">sua prova.</span></>
              )}
            </h2>
            <p className="mx-auto mt-7 max-w-[44ch] text-[1.15rem] text-brand-100">
              {dias > 0 ? `Faltam ${dias} dias para o ${proximo.edicao}º Exame. ` : ""}Conta gratuita, sem cartão.
            </p>
            <Link href={destinoPrincipal} className="mt-10 inline-flex min-h-14 items-center justify-center rounded-full bg-white px-10 text-[1.08rem] font-semibold text-ink transition-transform hover:scale-[1.04]">
              {rotuloPrincipal}
            </Link>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
