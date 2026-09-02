import type { Metadata } from "next";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { JsonLd } from "@/lib/jsonld";
import { abs } from "@/lib/site";
import { PaywallCta } from "@/components/paywall-cta";
import { getDisciplinas, getExames } from "@/lib/content/queries";
export const revalidate = 3600;
export const metadata: Metadata = {
  title: "O que mais cai na OAB: distribuição por disciplina",
  description:
    "Quantas questões de cada disciplina caem na 1ª fase do Exame de Ordem: a média por prova das 18 disciplinas do edital, do bloco que decide a aprovação à cauda longa.",
  alternates: { canonical: "/estatisticas" },
};
export default async function EstatisticasPage() {
  const [disciplinas, exames] = await Promise.all([
    getDisciplinas(),
    getExames(),
  ]);
  const maior = disciplinas[0]?.mediaPorProva ?? 1;
  const total = disciplinas.reduce((s, d) => s + d.mediaPorProva, 0);
  return (
    <>
      {/*
        `Dataset` porque é o que a página é: uma tabela de disciplina por
        média de questões. É o tipo que o Google entende para consulta de
        dado — "quantas questões de direito civil caem na OAB" — e o que
        permite a página aparecer com a tabela no resultado.

        `creditText` e a ressalva de estimativa não são enfeite: declarar
        medição onde há média histórica é o mesmo erro que a página combate.
      */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          "@id": abs("/estatisticas#dados"),
          name: "Distribuição de questões por disciplina no Exame de Ordem",
          description:
            "Média de questões por prova de cada uma das 18 disciplinas do edital da 1ª fase do Exame de Ordem Unificado. Estimativa a partir do histórico das provas aplicadas.",
          inLanguage: "pt-BR",
          license: "https://creativecommons.org/licenses/by/4.0/",
          isAccessibleForFree: true,
          creator: { "@id": abs("/#organization") },
          variableMeasured: disciplinas.map((d) => ({
            "@type": "PropertyValue",
            name: d.nome,
            value: d.mediaPorProva,
            unitText: "questões por prova",
          })),
        }}
      />
      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/estatisticas", label: "O que mais cai" },
        ]}
        eyebrow="Conteúdo aberto"
        titulo={
          <>
            O que <span className="text-ouro-500">mais cai</span> na OAB
          </>
        }
        descricao={`Média de questões por disciplina em ${exames.length} exames unificados. Quatro disciplinas sozinhas respondem por quase metade da prova — e essa proporção quase não muda de uma edição para a outra.`}
      />

      <Container className="py-16">
        <ul className="flex flex-col gap-3.5">
          {disciplinas.map((d) => (
            <li key={d.slug} className="flex items-center gap-4">
              <span className="w-[44%] shrink-0 text-[0.93rem] text-body sm:w-[32%]">
                {d.nome}
              </span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-sunk">
                <span
                  className="block h-full rounded-full bg-brand-500"
                  style={{ width: `${(d.mediaPorProva / maior) * 100}%` }}
                />
              </span>
              <span className="w-24 shrink-0 text-right text-[0.8rem] tabular-nums text-muted">
                {d.mediaPorProva} q ·{" "}
                {Math.round((d.mediaPorProva / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>

        <PaywallCta
          titulo="Estude na ordem que o dado indica"
          texto="No plano, o cronograma parte da data da sua prova e distribui o conteúdo por peso de incidência — começando pelo que mais cai e pelo que você mais erra."
        />
      </Container>
    </>
  );
}
