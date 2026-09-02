import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { PaywallCta } from "@/components/paywall-cta";
import { JsonLd } from "@/lib/jsonld";
import { formatarData } from "@/lib/format";
import { abs } from "@/lib/site";
import {
  getArtigosDoExame,
  getDisciplinas,
  getExame,
  getExames,
} from "@/lib/content/queries";
export const revalidate = 3600;
export const dynamicParams = true;
type Props = { params: Promise<{ edicao: string }> };
export async function generateStaticParams() {
  const exames = await getExames();
  return exames.map((e) => ({ edicao: e.slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { edicao } = await params;
  const exame = await getExame(edicao);
  if (!exame) return {};
  const titulo = `${exame.edicao}º Exame da OAB — gabarito e distribuição`;
  const descricao = `Ficha completa do ${exame.edicao}º Exame de Ordem Unificado, aplicado em ${formatarData(
    exame.data,
  )}: gabarito oficial e quantas questões caíram de cada disciplina.`;
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: `/exames/${exame.slug}` },
    openGraph: {
      type: "article",
      title: titulo,
      description: descricao,
      url: `/exames/${exame.slug}`,
    },
  };
}
export default async function ExamePage({ params }: Props) {
  const { edicao } = await params;
  const exame = await getExame(edicao);
  if (!exame) notFound();
  const [disciplinas, dispositivos] = await Promise.all([
    getDisciplinas(),
    getArtigosDoExame(exame.slug),
  ]);
  const nomes = new Map(disciplinas.map((d) => [d.slug, d.nome]));
  const linhas = [...exame.distribuicao].sort(
    (a, b) => b.questoes - a.questoes,
  );
  const maior = linhas[0]?.questoes ?? 1;
  const dataFormatada = formatarData(exame.data, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: `${exame.edicao}º Exame de Ordem Unificado`,
          inLanguage: "pt-BR",
          datePublished: exame.data,
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": abs(`/exames/${exame.slug}`),
          },
          author: { "@id": abs("/#organization") },
          publisher: { "@id": abs("/#organization") },
          isAccessibleForFree: true,
        }}
      />

      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/exames", label: "Exames" },
          { href: `/exames/${exame.slug}`, label: `${exame.edicao}º Exame` },
        ]}
        eyebrow={`1ª fase · ${dataFormatada}`}
        titulo={
          <>
            {exame.edicao}º Exame de{" "}
            <span className="text-ouro-500">Ordem</span>
          </>
        }
        descricao={`${exame.totalQuestoes} questões objetivas. Veja como a banca distribuiu a prova entre as disciplinas.`}
      />

      <Container className="py-16">
        {/* Ficha do exame: só o que veio de fonte oficial. */}
        <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "Questões no banco",
              `${exame.questoesCarregadas || "—"}`,
              exame.questoesCarregadas
                ? "extraídas do caderno oficial"
                : "edição ainda não ingerida",
            ],
            [
              "Anuladas",
              `${exame.questoesAnuladas}`,
              exame.questoesAnuladas
                ? "fora dos simulados, mantidas como estudo"
                : "nenhuma nesta edição",
            ],
            [
              "Gabarito",
              exame.gabaritoDefinitivo ? "definitivo" : "preliminar",
              exame.gabaritoDefinitivo
                ? "publicado após os recursos"
                : "a OAB não publicou o definitivo desta edição",
            ],
            ["Aplicação", dataFormatada, "conforme o edital"],
          ].map(([rotulo, valor, nota]) => (
            <div
              key={rotulo}
              className="flex flex-col gap-1 border-t border-line pt-4"
            >
              <dt className="text-[0.86rem] font-semibold text-muted">
                {rotulo}
              </dt>
              <dd className="text-[1.7rem] leading-none font-bold tracking-[-0.02em] text-ink">
                {valor}
              </dd>
              <dd className="text-[0.84rem] text-muted">{nota}</dd>
            </div>
          ))}
        </dl>

        {linhas.length > 0 ? (
          <>
            <h2 className="mt-16 text-[0.86rem] font-semibold text-muted">
              Distribuição por disciplina
            </h2>

            <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full min-w-[440px] border-collapse text-[0.93rem]">
                <thead>
                  <tr className="bg-sunk text-left">
                    <th className="px-6 py-3.5 text-[0.82rem] font-semibold text-muted">
                      Disciplina
                    </th>
                    <th className="px-6 py-3.5 text-[0.82rem] font-semibold text-muted">
                      Peso
                    </th>
                    <th className="px-6 py-3.5 text-right text-[0.82rem] font-semibold text-muted">
                      Questões
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha) => (
                    <tr
                      key={linha.disciplinaSlug}
                      className="border-t border-line"
                    >
                      <td className="px-6 py-3 text-body">
                        {nomes.get(linha.disciplinaSlug) ??
                          linha.disciplinaSlug}
                      </td>
                      <td className="px-6 py-3">
                        <span className="block h-2 w-full max-w-[180px] overflow-hidden rounded-full bg-sunk">
                          <span
                            className="block h-full rounded-full bg-brand-400"
                            style={{
                              width: `${(linha.questoes / maior) * 100}%`,
                            }}
                          />
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-ink">
                        {linha.questoes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          // A distribuição real depende de classificação confirmada por
          // revisão humana. Enquanto isso, dizer que não existe é melhor do
          // que exibir a estimativa como se fosse a prova desta edição.
          <p className="mt-14 max-w-[62ch] rounded-2xl border border-ouro-200 bg-ouro-100 p-6 text-[0.93rem] text-body">
            A distribuição por disciplina desta edição ainda não foi publicada:
            ela depende da revisão da classificação das questões, que é feita
            manualmente. A{" "}
            <Link
              href="/estatisticas"
              className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4"
            >
              distribuição típica da 1ª fase
            </Link>{" "}
            já está disponível.
          </p>
        )}

        {/* Dispositivos cobrados nesta prova.
            Duas funções ao mesmo tempo: é conteúdo que só existe porque
            temos o acervo — nenhuma outra ficha de exame diz qual artigo
            caiu — e é o caminho que leva o rastreador da página do exame
            para as páginas de artigo, que antes só apontavam para cá e
            nunca recebiam link de volta. */}
        {dispositivos.length > 0 && (
          <section className="mt-20">
            <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
              Dispositivos cobrados nesta prova
            </h2>
            <p className="mt-3 max-w-[62ch] text-[0.98rem] text-body">
              Artigos que o enunciado desta edição citou de forma expressa.
              Não é a lista completa do que a prova exigiu — a banca costuma
              narrar o caso sem nomear o dispositivo —, mas cada um destes é
              verificável relendo a questão.
            </p>

            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {dispositivos.map((d) => (
                <li key={`${d.leiSlug}-${d.artigoSlug}`}>
                  <Link
                    href={`/legislacao/${d.leiSlug}/${d.artigoSlug}`}
                    className="group flex h-full flex-col gap-1.5 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand-300"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink group-hover:text-brand-700">
                        Art. {d.numero} {d.leiSigla}
                      </span>
                      {d.questoes > 1 && (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[0.74rem] font-semibold text-brand-700 tabular-nums">
                          {d.questoes} questões
                        </span>
                      )}
                      {d.temComentario && (
                        <span className="rounded-full bg-ouro-100 px-2 py-0.5 text-[0.74rem] font-semibold text-ouro-700">
                          comentado
                        </span>
                      )}
                    </span>
                    <span className="line-clamp-2 text-[0.88rem] text-muted">
                      {d.caput}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <PaywallCta
          titulo={`Refaça o ${exame.edicao}º Exame cronometrado`}
          texto="No plano você responde a prova inteira em modo simulado, com o tempo real, e recebe o relatório de acerto por disciplina no fim."
        />
      </Container>
    </>
  );
}
