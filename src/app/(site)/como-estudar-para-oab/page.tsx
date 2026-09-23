import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { PaywallCta } from "@/components/paywall-cta";
import { JsonLd } from "@/lib/jsonld";
import { abs } from "@/lib/site";

export const revalidate = 3600;

const DESCRIPTION =
  "Um método prático para estudar para a OAB: organize o tempo até a prova, use os exames anteriores para diagnosticar lacunas e revise com base nos seus erros.";

export const metadata: Metadata = {
  title: "Como estudar para a OAB: método e roteiro prático",
  description: DESCRIPTION,
  alternates: { canonical: "/como-estudar-para-oab" },
};

const PASSOS = [
  {
    numero: "01",
    titulo: "Comece pela data e pelo tempo real",
    texto:
      "Consulte a data da próxima edição e conte quantas semanas você realmente tem. Depois, reserve blocos que caibam na sua rotina: um plano menor, executado todos os dias, vale mais do que uma agenda perfeita que não se sustenta.",
  },
  {
    numero: "02",
    titulo: "Faça um diagnóstico antes de acelerar",
    texto:
      "Resolva uma prova anterior ou um conjunto misto de questões sem consultar o material. O resultado não é uma sentença sobre você: é um mapa para descobrir quais matérias pedem leitura, quais pedem exercícios e quais já precisam só de revisão.",
  },
  {
    numero: "03",
    titulo: "Estude em blocos curtos e repetíveis",
    texto:
      "Alterne legislação, questões e revisão. Em vez de tentar terminar uma matéria inteira antes de tocar nas outras, distribua os assuntos ao longo da semana e volte a eles em intervalos. A regularidade cria memória e mostra cedo onde o plano está falhando.",
  },
  {
    numero: "04",
    titulo: "Corrija cada questão como parte do estudo",
    texto:
      "Depois de responder, leia o fundamento, registre por que errou e transforme a dúvida em um próximo passo. Acertar por chute também merece revisão; errar sem entender o motivo é o que não pode virar rotina.",
  },
];

export default function ComoEstudarParaOab() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Como estudar para a OAB: método e roteiro prático",
          description: DESCRIPTION,
          url: abs("/como-estudar-para-oab"),
          inLanguage: "pt-BR",
          author: { "@type": "Organization", name: "OABase", url: abs("/") },
          publisher: { "@type": "Organization", name: "OABase", url: abs("/") },
          isPartOf: { "@type": "WebSite", name: "OABase", url: abs("/") },
        }}
      />

      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/como-estudar-para-oab", label: "Como estudar para a OAB" },
        ]}
        eyebrow="Guia aberto"
        titulo={
          <>
            Como estudar para a <span className="text-ouro-500">OAB</span> com direção
          </>
        }
        descricao={DESCRIPTION}
      />

      <Container className="flex flex-col gap-16 py-16">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
          <div className="flex flex-col gap-5">
            <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
              O melhor cronograma é o que mostra o próximo passo
            </h2>
            <p className="max-w-[64ch] text-[1.02rem] leading-relaxed text-body">
              Estudar para a OAB não é tentar ler tudo de uma vez. É decidir o
              que merece atenção agora, medir o que mudou e voltar ao ponto
              fraco antes que ele apareça de novo na prova.
            </p>
            <p className="max-w-[64ch] text-[1.02rem] leading-relaxed text-body">
              Use este roteiro como ponto de partida e adapte a carga à sua
              semana. A página do{" "}
              <Link
                className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4"
                href="/proximo-exame"
              >
                próximo exame
              </Link>{" "}
              concentra as datas; os{" "}
              <Link
                className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4"
                href="/exames"
              >
                exames anteriores
              </Link>{" "}
              ajudam a transformar ansiedade em diagnóstico.
            </p>
          </div>
          <aside className="rounded-[20px] border border-ouro-200 bg-ouro-50/60 p-6 sm:p-7">
            <p className="text-[0.8rem] font-bold tracking-[0.08em] text-ouro-700 uppercase">Regra simples</p>
            <p className="mt-3 text-[1.2rem] leading-snug font-semibold text-ink">
              Toda sessão precisa terminar com uma evidência: uma questão
              corrigida, uma lei revisada ou uma dúvida anotada.
            </p>
          </aside>
        </section>

        <section aria-labelledby="passos" className="flex flex-col gap-8">
          <div>
            <p className="selo text-brand-700">Roteiro de estudo</p>
            <h2 id="passos" className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
              Quatro movimentos para repetir toda semana
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {PASSOS.map((passo) => (
              <article key={passo.numero} className="rounded-[20px] border border-line bg-white p-6 sm:p-7">
                <span className="font-mono text-[0.82rem] font-bold text-brand-600">{passo.numero}</span>
                <h3 className="mt-3 text-[1.2rem] leading-tight font-semibold text-ink">{passo.titulo}</h3>
                <p className="mt-3 text-[0.98rem] leading-relaxed text-body">{passo.texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="ferramentas" className="flex flex-col gap-6">
          <div>
            <p className="selo text-brand-700">No OABase</p>
            <h2 id="ferramentas" className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
              Cada etapa tem uma fonte para conferir
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <Link href="/legislacao" className="rounded-[20px] border border-line p-6 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
              <h3 className="font-semibold text-ink">Lei e súmulas</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-body">Leia o texto oficial e use o contexto comentado quando ele estiver disponível.</p>
            </Link>
            <Link href="/exames" className="rounded-[20px] border border-line p-6 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
              <h3 className="font-semibold text-ink">Provas anteriores</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-body">Treine com o caderno e o gabarito da edição correspondente, sem misturar diagnóstico com palpite.</p>
            </Link>
            <Link href="/estatisticas" className="rounded-[20px] border border-line p-6 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
              <h3 className="font-semibold text-ink">Incidência medida</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-body">Veja o que já foi contado no acervo e priorize com transparência sobre a origem dos dados.</p>
            </Link>
          </div>
        </section>

        <section aria-labelledby="evite" className="grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
          <div>
            <p className="selo text-vinho-600">Para não perder tempo</p>
            <h2 id="evite" className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-[-0.02em] sm:text-[2.3rem]">Três sinais de que o plano precisa mudar</h2>
          </div>
          <ul className="flex flex-col gap-4 text-[1.02rem] leading-relaxed text-body">
            <li className="border-l-2 border-vinho-300 pl-5"><strong className="text-ink">Você só assiste e não testa:</strong> inclua questões no mesmo dia da teoria.</li>
            <li className="border-l-2 border-vinho-300 pl-5"><strong className="text-ink">Você troca de material toda semana:</strong> escolha uma fonte confiável e registre as lacunas antes de procurar outra.</li>
            <li className="border-l-2 border-vinho-300 pl-5"><strong className="text-ink">Você mede apenas horas:</strong> acompanhe acertos, erros recorrentes e revisões concluídas.</li>
          </ul>
        </section>

        <PaywallCta
          titulo="Transforme o roteiro em prática diária"
          texto="O conteúdo aberto ajuda a montar o caminho. No plano OABase, você pode resolver questões comentadas, revisar seus erros e acompanhar o que já dominou em uma rotina só."
        />
      </Container>
    </>
  );
}
