import Link from "next/link";
import { Container } from "@/components/container";
import { Reveal } from "@/components/reveal";
import { getAcervo, getLeis } from "@/lib/content/queries";
import { JsonLd } from "@/lib/jsonld";
import { planos } from "@/lib/planos";
import { abs, site } from "@/lib/site";

export const revalidate = 3600;

const jornadas = [
  {
    numero: "01",
    titulo: "Diga o que precisa estudar",
    texto: "Escolha as matérias, informe a data da avaliação ou traga a ementa. O ponto de partida é a sua prova — não um cronograma genérico.",
  },
  {
    numero: "02",
    titulo: "Transforme conteúdo em blocos",
    texto: "O roadmap distribui os tópicos dentro das horas que você realmente tem e mostra o próximo passo sem esconder o restante do caminho.",
  },
  {
    numero: "03",
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

const perguntas = [
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
    a: "A consulta de legislação, súmulas, glossário, exames, estatísticas e textos do blog continua aberta. A conta guarda o que é seu: planos, progresso, foco, notas e revisões.",
  },
  {
    q: "E a 2ª fase da OAB?",
    a: "O roadmap pode organizar sua rotina, mas o banco de questões e os simulados são voltados à 1ª fase. Correção de peças e respostas discursivas ainda não faz parte do produto.",
  },
];

function IconeSeta() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M4 10h12M11.5 5.5 16 10l-4.5 4.5" />
    </svg>
  );
}

function PreviaDoPlano() {
  const blocos = [
    ["Hoje", "Direito Civil", "Obrigações · 45 min", "ativo"],
    ["Amanhã", "Direito Constitucional", "Leitura e revisão · 35 min", ""],
    ["Sex", "Revisão da semana", "Erros e anotações · 30 min", ""],
  ] as const;

  return (
    <div className="relative mx-auto w-full max-w-[590px] lg:mx-0">
      <div aria-hidden="true" className="absolute -top-10 -right-8 h-44 w-44 rounded-full border border-ouro-400/30 bg-ouro-400/10" />
      <div className="relative overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.08] p-2 shadow-[0_38px_90px_-34px_rgba(0,0,0,.8)] backdrop-blur-sm">
        <div className="rounded-[22px] bg-[#f8faf8] p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
            <div>
              <span className="text-[0.68rem] font-bold tracking-[0.12em] text-brand-600 uppercase">Seu roadmap</span>
              <h2 className="mt-1 text-[1.25rem] font-extrabold text-ink">Prova de Direito Civil</h2>
            </div>
            <span className="rounded-full bg-ouro-100 px-3 py-1.5 text-[0.7rem] font-bold text-ouro-700">12 dias</span>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_112px]">
            <ol className="flex flex-col gap-2.5">
              {blocos.map(([dia, disciplina, objetivo, estado]) => (
                <li key={`${dia}-${disciplina}`} className={`flex items-center gap-3 rounded-[14px] border p-3.5 ${estado ? "border-brand-200 bg-brand-50" : "border-line bg-white"}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-[0.65rem] font-bold ${estado ? "bg-brand-600 text-white" : "bg-sunk text-muted"}`}>{dia.slice(0, 3)}</span>
                  <div className="min-w-0">
                    <strong className="block truncate text-[0.78rem] text-ink">{disciplina}</strong>
                    <span className="block truncate text-[0.68rem] text-muted">{objetivo}</span>
                  </div>
                </li>
              ))}
            </ol>

            <div className="flex flex-row gap-2 sm:flex-col">
              {[["4", "blocos"], ["2h", "de foco"], ["75%", "da semana"]].map(([valor, rotulo]) => (
                <div key={rotulo} className="flex-1 rounded-[13px] bg-sunk p-3 text-center">
                  <strong className="block text-[0.95rem] text-brand-800">{valor}</strong>
                  <span className="text-[0.62rem] text-muted">{rotulo}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="auth-flutua-atrasada absolute -bottom-8 -left-3 rounded-[16px] border border-white/15 bg-noite px-4 py-3 text-white shadow-xl sm:-left-7">
        <span className="block text-[0.65rem] text-brand-200">Próximo passo</span>
        <strong className="text-[0.8rem]">já decidido</strong>
      </div>
    </div>
  );
}

export default async function Home() {
  const [acervo, leis] = await Promise.all([getAcervo(), getLeis()]);

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
              featureList: ferramentas.map(([titulo]) => titulo),
            },
          ],
        }}
      />

      <section className="relative isolate overflow-hidden bg-noite text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -top-[34%] right-[-10%] h-[850px] w-[850px] rounded-full bg-brand-400/25 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-[-45%] left-[-15%] h-[600px] w-[600px] rounded-full bg-ouro-400/10 blur-3xl" />
        <Container className="relative grid items-center gap-16 pt-16 pb-24 lg:grid-cols-[0.92fr_1.08fr] lg:pt-24 lg:pb-28">
          <div className="flex flex-col items-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-2 text-[0.72rem] font-bold tracking-[0.1em] text-brand-100 uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-ouro-400" />
              Da primeira prova à OAB
            </span>
            <h1 className="mt-7 max-w-[11ch] text-[clamp(3rem,6vw,5.4rem)] leading-[0.94] font-extrabold tracking-[-0.065em] text-white">
              Direito se estuda com direção.
            </h1>
            <p className="mt-7 max-w-[48ch] text-[clamp(1.05rem,1.7vw,1.28rem)] leading-relaxed text-brand-100">
              Transforme a matéria da faculdade, a próxima avaliação ou a preparação para a OAB em um plano que cabe na sua rotina — e saiba o que estudar toda vez que abrir o OABase.
            </p>
            <div className="mt-9 flex w-full flex-wrap gap-3 sm:w-auto">
              <Link href="/criar-conta" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ouro-400 px-7 font-semibold text-noite shadow-[0_14px_30px_-14px_rgba(233,162,59,.9)] transition-transform hover:-translate-y-0.5 hover:bg-ouro-200 sm:flex-none">
                Criar meu plano <IconeSeta />
              </Link>
              <Link href="#como-funciona" className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-white/25 px-7 font-semibold text-white transition-colors hover:border-white/60 hover:bg-white hover:text-brand-800 sm:flex-none">
                Ver como funciona
              </Link>
            </div>
            <p className="mt-5 text-[0.82rem] text-brand-200">Conta gratuita · faculdade ou OAB · sem cartão para começar</p>
            <Link
              href="/como-estudar-para-oab"
              className="mt-4 text-[0.9rem] font-semibold text-ouro-200 underline decoration-ouro-400/60 underline-offset-4 transition-colors hover:text-white"
            >
              Leia o guia: como estudar para a OAB →
            </Link>
          </div>
          <PreviaDoPlano />
        </Container>
      </section>

      <section className="bg-ouro-400 py-5">
        <Container className="flex flex-wrap items-center justify-center gap-x-10 gap-y-2 text-center text-[0.78rem] font-bold tracking-[0.08em] text-noite/75 uppercase">
          <span>Planejamento pessoal</span><span className="hidden h-1 w-1 rounded-full bg-noite/35 sm:block" />
          <span>Foco registrado</span><span className="hidden h-1 w-1 rounded-full bg-noite/35 sm:block" />
          <span>Revisão com contexto</span><span className="hidden h-1 w-1 rounded-full bg-noite/35 sm:block" />
          <span>Fontes oficiais</span>
        </Container>
      </section>

      <section className="bg-paper py-24">
        <Container>
          <Reveal className="max-w-[62ch]">
            <span className="text-[0.75rem] font-bold tracking-[0.13em] text-ouro-600 uppercase">Para o Direito que você estuda hoje</span>
            <h2 className="mt-4 text-[clamp(2.3rem,4.4vw,3.7rem)] leading-[0.98] font-extrabold tracking-[-0.055em] text-ink">A faculdade e a OAB pedem ritmos diferentes. O método acompanha os dois.</h2>
          </Reveal>
          <div className="mt-14 grid overflow-hidden rounded-[30px] border border-line bg-surface shadow-[var(--shadow-media)] lg:grid-cols-2">
            <article className="relative overflow-hidden bg-[#edf5f0] p-8 sm:p-11">
              <span className="selo">Durante a faculdade</span>
              <h3 className="mt-6 max-w-[15ch] text-[2rem] leading-[1.05] font-extrabold text-brand-900">Uma prova por vez, sem perder o semestre de vista.</h3>
              <p className="mt-5 max-w-[48ch] text-[0.96rem] leading-relaxed text-body">Cadastre a avaliação, escolha os tópicos e diga quanto tempo você tem. O roadmap monta a sequência e mantém leitura, foco e anotações ligados à disciplina.</p>
              <ul className="mt-8 flex flex-col gap-3 text-[0.9rem] text-brand-800">
                {["Plano regressivo até a avaliação", "Ementa revisada antes de virar roadmap", "Metas e materiais por bloco"].map((item) => <li key={item} className="flex items-center gap-3"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[0.65rem] text-white">✓</span>{item}</li>)}
              </ul>
            </article>
            <article className="relative overflow-hidden border-t border-line bg-[#f8edf1] p-8 sm:p-11 lg:border-t-0 lg:border-l">
              <span className="selo bg-white/70 text-vinho-700">Para o Exame de Ordem</span>
              <h3 className="mt-6 max-w-[15ch] text-[2rem] leading-[1.05] font-extrabold text-vinho-700">Quando a prova é nacional, os dados entram no plano.</h3>
              <p className="mt-5 max-w-[48ch] text-[0.96rem] leading-relaxed text-body">Use a incidência das disciplinas, treine com o acervo oficial da 1ª fase e deixe o caderno de erros decidir o que precisa voltar.</p>
              <ul className="mt-8 flex flex-col gap-3 text-[0.9rem] text-vinho-700">
                {[`${acervo.questoes.toLocaleString("pt-BR")} questões oficiais no acervo`, "Gabaritos da FGV e anulações preservadas", "Simulados e revisão espaçada"].map((item) => <li key={item} className="flex items-center gap-3"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-vinho-600 text-[0.65rem] text-white">✓</span>{item}</li>)}
              </ul>
            </article>
          </div>
        </Container>
      </section>

      <section id="como-funciona" className="scroll-mt-24 bg-surface py-24">
        <Container className="grid gap-14 lg:grid-cols-[0.72fr_1.28fr]">
          <Reveal>
            <span className="text-[0.75rem] font-bold tracking-[0.13em] text-ouro-600 uppercase">Como funciona</span>
            <h2 className="mt-4 max-w-[10ch] text-[clamp(2.3rem,4.2vw,3.5rem)] leading-[0.98] font-extrabold tracking-[-0.055em] text-ink">Menos tempo decidindo. Mais tempo estudando.</h2>
            <p className="mt-6 max-w-[42ch] text-[0.96rem] leading-relaxed text-body">O sistema não tenta substituir professor, livro ou aula. Ele organiza a execução entre uma sessão e outra.</p>
          </Reveal>
          <ol className="flex flex-col border-t-2 border-ink">
            {jornadas.map((passo) => (
              <li key={passo.numero} className="grid gap-3 border-b border-line py-7 sm:grid-cols-[64px_0.75fr_1.25fr] sm:gap-6">
                <span className="text-[0.76rem] font-bold tracking-[0.1em] text-ouro-600">{passo.numero}</span>
                <h3 className="text-[1.12rem] font-bold text-ink">{passo.titulo}</h3>
                <p className="text-[0.9rem] leading-relaxed text-body">{passo.texto}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="bg-brand-800 py-24 text-white">
        <Container>
          <Reveal className="max-w-[62ch]">
            <span className="text-[0.75rem] font-bold tracking-[0.13em] text-ouro-200 uppercase">Sua mesa de estudos</span>
            <h2 className="mt-4 text-[clamp(2.3rem,4.2vw,3.5rem)] leading-[0.98] font-extrabold tracking-[-0.055em] text-white">As ferramentas conversam entre si.</h2>
            <p className="mt-5 text-brand-100">O bloco do roadmap abre a sessão; a sessão registra o foco; o que ficou pendente alimenta a próxima revisão. Cada ação deixa o próximo passo mais claro.</p>
          </Reveal>
          <div className="mt-14 grid gap-px overflow-hidden rounded-[26px] border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {ferramentas.map(([titulo, texto], indice) => (
              <article key={titulo} className="bg-brand-800 p-7 transition-colors hover:bg-brand-700 sm:p-8">
                <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white/10 text-[0.72rem] font-bold text-ouro-200">0{indice + 1}</span>
                <h3 className="mt-5 text-[1.15rem] font-bold text-white">{titulo}</h3>
                <p className="mt-3 text-[0.88rem] leading-relaxed text-brand-100">{texto}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-paper py-24">
        <Container className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <Reveal className="lg:sticky lg:top-28">
            <span className="text-[0.75rem] font-bold tracking-[0.13em] text-ouro-600 uppercase">Conteúdo com origem</span>
            <h2 className="mt-4 max-w-[11ch] text-[clamp(2.3rem,4.2vw,3.5rem)] leading-[0.98] font-extrabold tracking-[-0.055em] text-ink">A organização pode ser inteligente. O Direito precisa ser verificável.</h2>
            <p className="mt-6 max-w-[45ch] text-[0.96rem] leading-relaxed text-body">Por isso a plataforma separa duas coisas: a tecnologia organiza seu tempo; o conteúdo jurídico vem de ato oficial ou de comentário autoral revisado.</p>
          </Reveal>
          <div className="overflow-hidden rounded-[26px] border border-line bg-surface shadow-[var(--shadow-baixa)]">
            <div className="border-b border-line p-7 sm:p-9">
              <span className="selo">Aberto e sem cadastro</span>
              <h3 className="mt-5 text-[1.45rem] font-bold text-ink">Consulte a fonte enquanto estuda</h3>
              <p className="mt-3 text-[0.9rem] text-body">Legislação artigo por artigo, súmulas, glossário e busca continuam acessíveis para qualquer estudante.</p>
            </div>
            <ul className="grid sm:grid-cols-2">
              {leis.slice(0, 6).map((lei) => (
                <li key={lei.slug} className="border-b border-line sm:odd:border-r">
                  <Link href={`/legislacao/${lei.slug}`} className="group flex items-center justify-between gap-4 px-7 py-4 text-[0.88rem] text-body hover:bg-brand-50 hover:text-brand-800">
                    <span>{lei.nome}</span><span className="opacity-35 group-hover:opacity-100">→</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 p-7 sm:p-9">
              <Link href="/legislacao" className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.84rem] font-semibold text-white hover:bg-brand-700">Abrir legislação</Link>
              <Link href="/busca" className="rounded-full border border-hairline px-5 py-2.5 text-[0.84rem] font-semibold text-ink hover:border-brand-300">Buscar no acervo</Link>
            </div>
          </div>
        </Container>
      </section>

      <section id="faq" className="scroll-mt-24 bg-surface py-24">
        <Container className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
          <Reveal>
            <span className="text-[0.75rem] font-bold tracking-[0.13em] text-ouro-600 uppercase">Perguntas</span>
            <h2 className="mt-4 max-w-[10ch] text-[clamp(2.3rem,4.2vw,3.5rem)] leading-[0.98] font-extrabold tracking-[-0.055em] text-ink">Antes de começar</h2>
          </Reveal>
          <dl className="flex flex-col border-t-2 border-ink">
            {perguntas.map((item) => (
              <div key={item.q} className="border-b border-line py-6">
                <dt className="text-[1.08rem] font-bold text-ink">{item.q}</dt>
                <dd className="mt-2 max-w-[70ch] text-[0.92rem] leading-relaxed text-body">{item.a}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <section id="planos" className="scroll-mt-24 bg-paper pb-24">
        <Container>
          <div className="relative overflow-hidden rounded-[32px] bg-noite p-8 shadow-[var(--shadow-alta)] sm:p-12 lg:p-14">
            <div aria-hidden="true" className="pointer-events-none absolute -top-40 -right-32 h-[420px] w-[420px] rounded-full bg-brand-400/20 blur-3xl" />
            <div className="relative max-w-[62ch]">
              <span className="selo selo-claro">Planos de estudo</span>
              <h2 className="mt-5 text-[clamp(2.2rem,4.2vw,3.4rem)] leading-[1] font-extrabold tracking-[-0.05em] text-white">Comece por uma prova. Fique pelo seu progresso.</h2>
              <p className="mt-5 text-brand-100">Crie a conta sem pagar e escolha o período quando quiser liberar todas as ferramentas. O plano mensal funciona tanto para a faculdade quanto para a preparação da OAB.</p>
            </div>
            <div className="relative mt-11 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {planos.map((plano) => (
                <article key={plano.chave} className={`flex flex-col rounded-[18px] border p-6 ${plano.destaque ? "border-ouro-400 bg-surface" : "border-white/15 bg-white/[0.06]"}`}>
                  <span className={`text-[0.82rem] font-semibold ${plano.destaque ? "text-vinho-600" : "text-brand-100"}`}>{plano.nome}</span>
                  <strong className={`mt-2 text-[2.25rem] leading-none font-extrabold tracking-[-0.04em] ${plano.destaque ? "text-ink" : "text-white"}`}>{plano.preco}</strong>
                  <span className={`mt-1 text-[0.76rem] ${plano.destaque ? "text-muted" : "text-brand-200"}`}>{plano.periodo}</span>
                  <p className={`mt-5 flex-1 border-t pt-5 text-[0.84rem] leading-relaxed ${plano.destaque ? "border-line text-body" : "border-white/15 text-brand-100"}`}>{plano.resumo}</p>
                  <Link href={`/app/assinar?plano=${plano.chave}`} className={`mt-6 flex min-h-11 items-center justify-center rounded-full px-4 text-center text-[0.82rem] font-semibold ${plano.destaque ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-white/25 text-white hover:bg-white hover:text-brand-800"}`}>{plano.cta}</Link>
                </article>
              ))}
            </div>
            <p className="relative mt-7 text-[0.82rem] text-brand-200">Pix ou cartão · sem fidelidade · <Link href="/precos" className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">comparar os planos em detalhe</Link></p>
          </div>
        </Container>
      </section>
    </>
  );
}
