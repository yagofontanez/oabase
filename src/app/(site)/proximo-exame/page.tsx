import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { PaywallCta } from "@/components/paywall-cta";
import { JsonLd } from "@/lib/jsonld";
import { formatarData } from "@/lib/format";
import { abs } from "@/lib/site";
import {
  diasAte,
  getAplicacoes,
  getDisciplinas,
  getExames,
  getProximoExame,
} from "@/lib/content/queries";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Próximo Exame de Ordem: data, formato e o que estudar",
  description:
    "Quando é a próxima 1ª fase do Exame de Ordem Unificado, o calendário das aplicações seguintes e o que a prova cobra: 80 questões, cinco horas, 40 acertos para passar.",
  alternates: { canonical: "/proximo-exame" },
};

/**
 * Contagem regressiva e calendário — a única página aberta nova que escala
 * sem custar comentário autoral.
 *
 * Todo o conteúdo aqui é ato oficial ou medição do próprio acervo: as datas
 * saem do cronograma do Conselho Federal (`aplicacoes` em `data.ts`, com a
 * fonte no comentário de lá), o formato da prova é o do edital, e o histórico
 * de aplicações vem da tabela `exames`, cada linha com data conferida no
 * edital da edição. Nada aqui é opinião sobre direito, que é justamente o que
 * permite publicar sem passar pela fila de redação.
 *
 * **O que esta página não faz é inventar prazo.** Data de inscrição, valor da
 * taxa e número do edital mudam a cada edição e não estão no acervo; afirmar
 * qualquer um deles seria o tipo de erro que faz alguém perder a prova. A
 * página diz o que sabe, com a fonte à vista, e manda ao edital para o resto.
 */
export default async function ProximoExame() {
  const [proximo, aplicacoes, disciplinas, exames] = await Promise.all([
    getProximoExame(),
    getAplicacoes(),
    getDisciplinas(),
    getExames(),
  ]);

  const dias = diasAte(proximo.data);
  const futuras = aplicacoes.filter((a) => !a.passou);
  // A última aplicação publicada. Quando ela já passou, o calendário está
  // vencido — e a página precisa dizer isso em vez de exibir uma contagem
  // regressiva para uma data que ficou para trás.
  const calendarioVencido = futuras.length === 0;

  const aplicados = exames.filter((e) => e.questoesCarregadas > 0);
  const topo = disciplinas.slice(0, 4);
  const questoesDoTopo = topo.reduce((s, d) => s + d.mediaPorProva, 0);

  const faq = [
    {
      q: "Quando é o próximo Exame de Ordem?",
      a: calendarioVencido
        ? `A última aplicação publicada pelo Conselho Federal foi a do ${proximo.edicao}º Exame, em ${formatarData(proximo.data)}. O cronograma seguinte ainda não saiu.`
        : `A 1ª fase do ${proximo.edicao}º Exame de Ordem Unificado está marcada para ${formatarData(proximo.data)}, conforme o cronograma publicado pelo Conselho Federal da OAB. Faltam ${dias} ${dias === 1 ? "dia" : "dias"}.`,
    },
    {
      q: "Quantas questões tem a 1ª fase?",
      a: "São 80 questões objetivas, de múltipla escolha com quatro alternativas e uma única correta. Nas 43 edições do acervo esse número só variou uma vez: o 3º Exame, em 2011, teve 100 questões.",
    },
    {
      q: "Quantos acertos preciso para passar na 1ª fase?",
      a: "Quarenta. A aprovação exige 50% de acertos, e a nota não é relativa: não há classificação nem corte móvel, então quem faz 40 passa independentemente de como foi o resto dos inscritos.",
    },
    {
      q: "Quanto tempo dura a prova?",
      a: "Cinco horas, das 13h às 18h. Dividido por 80 questões, dá três minutos e quarenta e cinco segundos por questão — e os enunciados vêm ficando mais longos: a média subiu de cerca de 300 caracteres nas primeiras edições para mais de 600 nas recentes.",
    },
    {
      q: "O que mais cai na 1ª fase?",
      a: `Ética e Estatuto da OAB, Direito Civil, Direito Processual Civil e Direito Constitucional respondem por cerca de ${Math.round(questoesDoTopo)} das 80 questões. A proporção entre as disciplinas quase não muda de uma edição para a outra.`,
    },
  ];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />

      {/*
        `Event` é o tipo que corresponde ao que a página de fato anuncia: uma
        aplicação marcada, com data. `eventAttendanceMode` presencial porque a
        1ª fase é aplicada em papel, em local designado — e declarar online
        seria informação errada num campo que o buscador exibe.

        Só entra quando há aplicação futura publicada: marcar como evento uma
        data que já passou é o mesmo defeito que a contagem travada em zero.
      */}
      {!calendarioVencido && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Event",
            "@id": abs("/proximo-exame#evento"),
            name: `1ª fase do ${proximo.edicao}º Exame de Ordem Unificado`,
            description:
              "Prova objetiva com 80 questões de múltipla escolha, aplicada em todo o país. A aprovação exige 40 acertos.",
            startDate: proximo.data,
            eventAttendanceMode:
              "https://schema.org/OfflineEventAttendanceMode",
            eventStatus: "https://schema.org/EventScheduled",
            inLanguage: "pt-BR",
            location: {
              "@type": "Country",
              name: "Brasil",
            },
            organizer: {
              "@type": "Organization",
              name: "Ordem dos Advogados do Brasil — Conselho Federal",
              url: "https://www.oab.org.br",
            },
            url: abs("/proximo-exame"),
          }}
        />
      )}

      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/proximo-exame", label: "Próximo exame" },
        ]}
        eyebrow="Conteúdo aberto"
        titulo={
          calendarioVencido ? (
            <>
              O próximo <span className="text-ouro-500">exame</span>
            </>
          ) : (
            <>
              Faltam{" "}
              <span className="text-ouro-500 tabular-nums">{dias}</span>{" "}
              {dias === 1 ? "dia" : "dias"} para a 1ª fase
            </>
          )
        }
        descricao={
          calendarioVencido
            ? `A última aplicação publicada pelo Conselho Federal foi a do ${proximo.edicao}º Exame, em ${formatarData(proximo.data)}. Assim que o cronograma seguinte sair, a data aparece aqui.`
            : `A 1ª fase do ${proximo.edicao}º Exame de Ordem Unificado está marcada para ${formatarData(proximo.data)}. São 80 questões objetivas em cinco horas, e 40 acertos aprovam.`
        }
      />

      <Container className="flex flex-col gap-16 py-16">
        {/* ---- A régua da prova ---------------------------------------- */}
        <section className="flex flex-col gap-6">
          <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
            A régua é fixa
          </h2>
          <p className="max-w-[70ch] text-[1.02rem] leading-relaxed text-body">
            A 1ª fase não classifica ninguém. Não existe nota de corte que suba
            porque a turma foi bem, nem vaga disputada: a régua é 50% e ela não
            se move. Quem acerta 40 das 80 passa, e é só isso que a prova
            pergunta.
          </p>
          <dl className="grid gap-4 sm:grid-cols-3">
            {[
              {
                valor: "80",
                rotulo: "questões objetivas",
                nota: "Quatro alternativas, uma correta. Só o 3º Exame fugiu disso, com 100.",
              },
              {
                valor: "5h",
                rotulo: "das 13h às 18h",
                nota: "Três minutos e quarenta e cinco segundos por questão, em média.",
              },
              {
                valor: "40",
                rotulo: "acertos para passar",
                nota: "Metade. Sem classificação e sem corte móvel.",
              },
            ].map((item) => (
              <div
                key={item.rotulo}
                className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-6"
              >
                <dt className="text-[2.4rem] leading-none font-bold tracking-[-0.04em] text-brand-600 tabular-nums">
                  {item.valor}
                </dt>
                <dd className="flex flex-col gap-2">
                  <span className="text-[0.98rem] font-semibold text-ink">
                    {item.rotulo}
                  </span>
                  <span className="text-[0.88rem] leading-relaxed text-muted">
                    {item.nota}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---- Calendário ---------------------------------------------- */}
        <section className="flex flex-col gap-6">
          <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
            Calendário das aplicações
          </h2>
          <p className="max-w-[70ch] text-[1.02rem] leading-relaxed text-body">
            As datas abaixo são as do cronograma publicado pelo Conselho Federal
            da OAB. Elas valem para a 1ª fase; inscrição, taxa e local de prova
            saem no edital de cada edição, e é lá que devem ser conferidos — não
            aqui.
          </p>

          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {aplicacoes.map((aplicacao) => {
              const restam = diasAte(aplicacao.data);
              return (
                <li
                  key={aplicacao.edicao}
                  className={`flex flex-wrap items-baseline gap-x-8 gap-y-1 p-6 ${
                    aplicacao.passou ? "opacity-55" : ""
                  }`}
                >
                  <span className="text-2xl font-bold tracking-[-0.03em] text-ink">
                    {aplicacao.edicao}º Exame
                  </span>
                  <span className="text-[0.9rem] tabular-nums text-body">
                    {formatarData(aplicacao.data, {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <span className="ml-auto text-[0.82rem] tabular-nums text-muted">
                    {aplicacao.passou
                      ? "aplicada"
                      : restam === 0
                        ? "hoje"
                        : `em ${restam} ${restam === 1 ? "dia" : "dias"}`}
                  </span>
                </li>
              );
            })}
          </ul>

          {calendarioVencido && (
            /* O comportamento seguro do calendário — a última aplicação
               continua valendo — precisa ser visível, senão a página mente
               em silêncio. Ver `aplicacoes` em `data.ts`. */
            <p className="rounded-2xl border border-ouro-200 bg-ouro-50 p-6 text-[0.94rem] leading-relaxed text-body">
              <strong className="font-semibold text-ink">
                O calendário acima está vencido.
              </strong>{" "}
              Todas as aplicações publicadas já aconteceram, e o Conselho
              Federal ainda não divulgou o cronograma seguinte. Nenhuma data
              futura é exibida aqui até que ele saia — chutar um mês provável
              seria pior do que não dizer nada.
            </p>
          )}
        </section>

        {/* ---- O que estudar ------------------------------------------- */}
        <section className="flex flex-col gap-6">
          <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
            Por onde começar, se falta pouco
          </h2>
          <p className="max-w-[70ch] text-[1.02rem] leading-relaxed text-body">
            A distribuição por disciplina é estável entre as edições, e isso é o
            que torna a véspera administrável: quatro disciplinas sozinhas
            respondem por cerca de {Math.round(questoesDoTopo)} das 80 questões.
            Nenhuma delas exige doutrina profunda — exigem reconhecer o instituto
            dentro de um caso curto.
          </p>

          <ul className="grid gap-3 sm:grid-cols-2">
            {topo.map((disciplina) => (
              <li
                key={disciplina.slug}
                className="flex items-baseline justify-between gap-4 rounded-xl border border-line bg-surface px-5 py-4"
              >
                <span className="text-[1rem] font-semibold text-ink">
                  {disciplina.nome}
                </span>
                <span className="text-[0.86rem] tabular-nums text-brand-600">
                  ~{Math.round(disciplina.mediaPorProva)} questões
                </span>
              </li>
            ))}
          </ul>

          {/* A ressalva não é rodapé: a média por prova é estimativa
              histórica, e declará-la como medição é o erro que
              `/estatisticas` existe para não cometer. */}
          <p className="max-w-[70ch] text-[0.92rem] leading-relaxed text-muted">
            Os números acima são a média histórica por prova, não a contagem de
            uma edição específica. A distribuição exata de cada exame aplicado
            está em <Link href="/estatisticas" className="font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4">o que mais cai</Link>, e a ficha de
            cada uma das {aplicados.length} edições do acervo — com data, gabarito
            e anulações — está em{" "}
            <Link
              href="/exames"
              className="font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4"
            >
              exames
            </Link>
            .
          </p>
        </section>

        {/* ---- Perguntas ----------------------------------------------- */}
        <section className="flex flex-col gap-6">
          <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
            Perguntas frequentes
          </h2>
          <dl className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {faq.map((item) => (
              <div key={item.q} className="flex flex-col gap-2 p-6">
                <dt className="text-[1.05rem] font-semibold text-ink">
                  {item.q}
                </dt>
                <dd className="max-w-[70ch] text-[0.96rem] leading-relaxed text-body">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <PaywallCta
          titulo={
            calendarioVencido
              ? "O tempo até a próxima prova é o que você tem"
              : `${dias} ${dias === 1 ? "dia" : "dias"} é tempo`
          }
          texto="No plano você resolve as questões reais das provas anteriores com correção na hora, revisão espaçada do que errar e simulado cronometrado na régua da 1ª fase — 80 questões, cinco horas."
        />
      </Container>
    </>
  );
}
