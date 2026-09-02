import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { JsonLd } from "@/lib/jsonld";
import { operador } from "@/lib/legal";
import { abs, site } from "@/lib/site";
import { getExames, getLeis, getProximoExame } from "@/lib/content/queries";

/**
 * Sobre.
 *
 * Não é página institucional de enfeite. Conteúdo jurídico é avaliado pelo
 * Google sob critério de confiabilidade — quem escreveu, com base em quê, e
 * por que se deveria acreditar. Um site que comenta lei sem dizer de onde
 * tira o texto e como classifica o que cobra é indistinguível de uma fazenda
 * de conteúdo, e ranqueia como uma.
 *
 * Daí o formato: método e procedência, com número medido do próprio banco,
 * e admissão explícita do que ainda é estimativa. Dizer o que não se sabe é
 * o que dá peso ao que se afirma.
 */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Sobre o OABase: método, fontes e limites",
  description:
    "De onde vem cada dado do OABase: legislação do Planalto, provas e gabaritos oficiais da FGV, estatísticas medidas do próprio acervo — e o que ainda é estimativa.",
  alternates: { canonical: abs("/sobre") },
};

export default async function SobrePage() {
  const [exames, leis, proximo] = await Promise.all([
    getExames(),
    getLeis(),
    getProximoExame(),
  ]);

  const ingeridos = exames.filter((e) => e.questoesCarregadas > 0);
  const questoes = ingeridos.reduce((s, e) => s + e.questoesCarregadas, 0);
  const definitivos = ingeridos.filter((e) => e.gabaritoDefinitivo).length;

  const numeros = [
    { valor: questoes.toLocaleString("pt-BR"), rotulo: "questões no acervo" },
    { valor: String(ingeridos.length), rotulo: "exames ingeridos" },
    {
      valor: `${definitivos}/${ingeridos.length}`,
      rotulo: "com gabarito definitivo",
    },
    { valor: String(leis.length), rotulo: "códigos completos" },
  ];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "@id": abs("/sobre"),
          name: "Sobre o OABase",
          inLanguage: "pt-BR",
          mainEntity: { "@id": abs("/#organization") },
        }}
      />

      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/sobre", label: "Sobre" },
        ]}
        eyebrow="Método e procedência"
        titulo={
          <>
            De onde vem <span className="text-ouro-500">cada dado</span> daqui
          </>
        }
        descricao="Um site que comenta lei precisa dizer de onde tira o texto, como classifica o que cobra e o que ainda não sabe. Esta página é isso."
      />

      <Container className="py-16">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {numeros.map((n) => (
            <div
              key={n.rotulo}
              className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-6"
            >
              <dd className="text-[2rem] leading-none font-bold tracking-[-0.03em] text-brand-700 tabular-nums">
                {n.valor}
              </dd>
              <dt className="text-[0.9rem] text-muted">{n.rotulo}</dt>
            </div>
          ))}
        </dl>

        <div className="mt-16 grid gap-14 lg:grid-cols-[0.75fr_1.25fr]">
          <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
            As fontes
          </h2>

          <div className="comentario max-w-[68ch] text-[1.02rem]">
            <p>
              <strong>A legislação</strong> vem do texto compilado publicado
              pelo Planalto — a versão consolidada, com a redação vigente de
              cada dispositivo, não a original de quando a lei foi promulgada.
              São {leis.length} códigos carregados artigo por artigo, do art.
              1º ao último, sem seleção editorial do que entra.
            </p>
            <p>
              <strong>As questões e os gabaritos</strong> saem dos cadernos
              oficiais publicados pela FGV no arquivo do Exame de Ordem.
              Enunciado, alternativas, gabarito e anulação são reproduzidos
              como estão na fonte. Quando a banca publica gabarito definitivo
              depois dos recursos, é ele que vale — e a página do exame diz se
              o gabarito daquela edição é definitivo ou ainda preliminar.
            </p>
            <p>
              <strong>Questões anuladas continuam no acervo.</strong> Elas saem
              dos simulados, porque não têm resposta certa para treinar, mas
              ficam disponíveis como estudo: o histórico de anulações diz muito
              sobre onde a própria banca considera que se expressou mal.
            </p>
            <p>
              O OABase é um serviço independente. Não temos vínculo com a OAB
              nem com a FGV, e nada aqui é comunicado oficial de exame —
              prazos, editais e resultados devem ser conferidos nos canais da
              banca.
            </p>
          </div>
        </div>

        <div className="mt-16 grid gap-14 lg:grid-cols-[0.75fr_1.25fr]">
          <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
            O que ainda é estimativa
          </h2>

          <div className="comentario max-w-[68ch] text-[1.02rem]">
            <p>
              <strong>A classificação por disciplina.</strong> Cada questão é
              associada a uma disciplina do edital por um léxico
              determinístico, corrigido por um fato da prova: a FGV monta o
              caderno em blocos contíguos por matéria. A acurácia medida contra
              revisão manual ficou em torno de 78%, abaixo da barra que a gente
              considera aceitável — por isso nenhuma questão está marcada como
              classificação confirmada, e a distribuição por disciplina exibida
              no site é média histórica, não contagem do acervo.
            </p>
            <p>
              <strong>A incidência de cada artigo</strong> conta apenas as
              questões que citam o dispositivo no próprio enunciado. É pouco de
              propósito: a prova narra um caso e quase nunca nomeia o artigo,
              então o número é um piso verificável, não o total real. Ele
              cresce conforme os comentários são escritos e o vínculo é
              confirmado à mão.
            </p>
            <p>
              <strong>Os comentários estão sendo escritos.</strong> Artigo sem
              comentário revisado continua acessível e completo no texto legal,
              mas não é anunciado ao buscador — a página existe para quem
              chega, e não para inflar o índice.
            </p>
          </div>
        </div>

        <div className="mt-16 grid gap-14 lg:grid-cols-[0.75fr_1.25fr]">
          <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
            Por que tanta coisa é aberta
          </h2>

          <div className="comentario max-w-[68ch] text-[1.02rem]">
            <p>
              A legislação comentada, as fichas dos exames e as estatísticas de
              incidência ficam abertas, sem cadastro e sem limite de leitura.
              Não é isca: saber o que mais cai não deveria ser vantagem
              competitiva de curso nenhum, e ler a lei comentada é a parte do
              estudo que rende mais ponto por hora.
            </p>
            <p>
              O plano cobre o que depende do seu progresso individual — banco
              de questões, simulado cronometrado, caderno de erros, revisão
              espaçada e cronograma. É a parte que só faz sentido com conta,
              porque acompanha você.
            </p>
            <p>
              A 1ª fase do {proximo.edicao}º Exame é a próxima. Se quiser
              começar pelo conteúdo aberto, a{" "}
              <Link href="/legislacao">legislação</Link> e as{" "}
              <Link href="/estatisticas">estatísticas</Link> estão ali.
            </p>
          </div>
        </div>

        <div className="mt-16 rounded-2xl border border-line bg-surface p-8">
          <h2 className="text-[1.2rem] font-bold text-ink">Contato</h2>
          <p className="mt-2 max-w-[62ch] text-[0.96rem] text-body">
            Achou erro em um comentário, uma questão mal extraída ou um
            gabarito divergente? Escreva para{" "}
            <strong className="text-ink">{operador.email}</strong>. Correção de
            conteúdo tem prioridade sobre qualquer outra coisa aqui.
          </p>
          <p className="mt-4 text-[0.88rem] text-muted">
            Veja também os <Link href="/termos">Termos de Uso</Link> e a{" "}
            <Link href="/privacidade">Política de Privacidade</Link>.
          </p>
        </div>
      </Container>
    </>
  );
}
